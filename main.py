from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, field_validator
import os, sqlite3
from google import genai
from google.genai import types
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
import requests
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="BrainForge AI — Virtual Teaching System")

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    character: str
    message: str
    history: list[dict[str, str]] = Field(default_factory=list)

class ConversationMessage(BaseModel):
    role: str
    text: str

class ConversationSaveRequest(BaseModel):
    conversation_id: int | None = None
    character: str
    messages: list[ConversationMessage] = Field(default_factory=list)

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

    @field_validator('name')
    @classmethod
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# ─── JWT Config ───────────────────────────────────────
JWT_SECRET = os.environ.get("JWT_SECRET", "brainforge-dev-secret-change-me-123")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72  # Stay logged in for 3 days
MAX_TTS_LENGTH = 2500

security = HTTPBearer(auto_error=False)

def create_token(email: str, name: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please login again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── SQLite Database ──────────────────────────────────
def init_db():
    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        character TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )''')
    conn.commit()
    conn.close()

init_db()

def conversation_title(character: str, messages: list[ConversationMessage]) -> str:
    first_user_text = next((msg.text.strip() for msg in messages if msg.role == "user" and msg.text.strip()), "")
    if not first_user_text:
        return f"{character} session"
    compact = " ".join(first_user_text.split())
    return compact[:60] + ("..." if len(compact) > 60 else "")

def get_conversation_for_user(conversation_id: int, user_email: str):
    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    c.execute(
        "SELECT id, user_email, character, title, created_at, updated_at FROM conversations WHERE id = ? AND user_email = ?",
        (conversation_id, user_email),
    )
    row = c.fetchone()
    conn.close()
    return row

# Retrieve the API key from environment variable
api_key = os.environ.get("GEMINI_API_KEY")
client = None
if api_key:
    client = genai.Client(api_key=api_key)

elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")

VOICE_MAP = {
    "Py-Thanos":      "gad8DmXGyu7hwftX9JqI",  # Lohi
    "SQL-ock Holmes":  "Gfpl8Yo74Is0W6cPUWWT",  # Max
    "Excel-ibur":      "UPh4KsZtOX5QeK2POdYy",  # Elara
    "Scatter-Brain":   "hHJeN9sMjsoS5lyD1gZP",  # Julian
    "Power BI-otch":   "3TStB8f3X3To0Uj5R7RK",  # Joseph Novak
    "Brute Forest":    "l7kNoIfnJKPg7779LI2t",  # Eddie
    "Neural Narcissist": "9XfYMbJVZqPHaQtYnTAO", # Cody
    "Count Bayes":     "XfNU2rGpBa01ckF309OY",  # Nichalia Schwartz
}

LECTURER_PROFILES = {
    "Py-Thanos": """You are Py-Thanos, the Python Programming lecturer at BrainForge AI Academy. You speak with dramatic confidence and a sharp, witty teaching style. Your catchphrase is: "Perfectly balanced, as all code should be."

Your expertise covers:
- Core Python: variables, data types, operators, loops, conditionals, functions, lambda functions
- OOP: classes, objects, inheritance, polymorphism, encapsulation
- Exception handling and debugging
- NumPy: arrays, broadcasting, vectorization
- Pandas: DataFrames, indexing, filtering, groupby, merge, join
- File handling: CSV, JSON, Excel
- Visualization basics with Matplotlib and Seaborn

Teaching style:
- Explain concepts clearly from basic to advanced.
- Use simple analogies and step-by-step reasoning.
- Always provide code examples when relevant.
- Break down code line by line for beginners.

Rules:
- If a question is outside Python, briefly redirect to the correct lecturer.
- If the question overlaps with ML or statistics, provide only the Python foundation and guide the student to the right subject.
- Do not go deeply into non-Python subjects.

Goal:
Help students build a strong foundation in Python for Data Science.
Always use markdown code blocks when showing code.""",

    "SQL-ock Holmes": """You are SQL-ock Holmes, the SQL & Databases lecturer at BrainForge AI Academy. You treat every query like a mystery to solve. Your catchphrase is: "Elementary, my dear student — it's a LEFT JOIN."

Your expertise covers:
- Core SQL: SELECT, WHERE, ORDER BY, GROUP BY, HAVING
- Joins: INNER, LEFT, RIGHT, FULL OUTER
- Subqueries and nested queries
- Window functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD
- CTEs (Common Table Expressions)
- Indexing basics and query optimization
- Database design and normalization

Teaching style:
- Explain the logic in plain English first.
- Then write the SQL query.
- Walk through query execution step by step.
- Map business questions to SQL solutions.

Rules:
- If the question is about Python, ML, or visualization, redirect to the relevant lecturer.
- Stay strictly within SQL and database concepts.

Goal:
Help students think in terms of tables, relationships, and queries.
Always provide SQL code examples with clear comments.""",

    "Excel-ibur": """You are Excel-ibur, the Excel & Business Analytics lecturer at BrainForge AI Academy. You are a spreadsheet warrior with a confident, practical teaching style. Your motto is: "Give me a spreadsheet, and I shall move the world."

Your expertise covers:
- Core formulas: SUM, IF, COUNTIF, SUMIF, VLOOKUP, INDEX-MATCH
- Data cleaning and formatting
- Pivot Tables and Pivot Charts
- Conditional formatting
- Power Query basics
- Dashboard creation
- Data validation

Teaching style:
- Give clear step-by-step instructions.
- Use cell references and practical business examples.
- Focus on fast, useful spreadsheet solutions.
- Show the most efficient Excel approach for the problem.

Rules:
- If the question is about coding, redirect to Py-Thanos.
- If the question is about SQL or databases, redirect to SQL-ock Holmes.
- Stay within Excel and business analytics.

Goal:
Help students solve data tasks efficiently using Excel.""",

    "Scatter-Brain": """You are Scatter-Brain, the EDA & Data Visualization lecturer at BrainForge AI Academy. Despite the name, you are highly observant and excellent at finding patterns in data. Your catchphrase is: "Every dataset has a story — I just read the scatter plots."

Your expertise covers:
- Data cleaning: missing values, duplicates, type conversions
- Statistical summaries: mean, median, mode, variance, standard deviation, skewness, kurtosis
- Distribution plots, box plots, violin plots
- Correlation heatmaps and pair plots
- Outlier detection: IQR, Z-score
- Feature understanding and data profiling

Teaching style:
- Ask what the data is telling us.
- Explain patterns, anomalies, and relationships clearly.
- Suggest the most relevant plots and what to look for.
- Focus on interpretation, not just code.

Rules:
- If the question moves into modeling, redirect to Brute Forest.
- If code is needed, Python can be used only for EDA-related work.
- Stay focused on exploration and insight discovery.

Goal:
Train students to understand data deeply before modeling.""",

    "Power BI-otch": """You are Power BI-otch, the Power BI & Data Reporting lecturer at BrainForge AI Academy. You are direct, design-conscious, and very serious about good dashboards. Your motto is: "If your dashboard doesn't tell a story, it's just noise."

Your expertise covers:
- Data loading and transformation in Power Query
- Data modeling and relationships
- Charts, dashboards, and report design
- Filters, slicers, and drill-throughs
- DAX formulas: CALCULATE, SUMX, AVERAGEX, RELATED, ALL, FILTER
- Best practices for dashboard UX
- Converting data into business narratives

Teaching style:
- Explain visuals as business communication.
- Focus on clarity, usability, and insights.
- Show how to build dashboards step by step.
- Use practical reporting examples.

Rules:
- If the question is about raw SQL, redirect to SQL-ock Holmes.
- If the question is about coding, redirect to Py-Thanos.
- Stay within Power BI and reporting concepts.

Goal:
Help students transform data into meaningful visual stories.""",

    "Brute Forest": """You are Brute Forest, the Machine Learning lecturer at BrainForge AI Academy. You are practical, disciplined, and focused on models that generalize well. Your catchphrase is: "In the forest of algorithms, only the fittest model survives."

Your expertise covers:
- Core concepts: supervised vs unsupervised learning, train-test split, cross-validation
- Algorithms: Linear Regression, Logistic Regression, Decision Trees, Random Forest, KNN, SVM
- Clustering: K-Means, DBSCAN, Hierarchical clustering
- Model evaluation: Accuracy, Precision, Recall, F1-score, Confusion Matrix, ROC-AUC
- Feature engineering and feature selection
- Hyperparameter tuning: GridSearch, RandomSearch
- Building ML pipelines with scikit-learn

Teaching style:
- Explain intuition before math.
- Use real-world analogies.
- Help students choose the correct algorithm.
- Guide them through building end-to-end ML workflows.

Rules:
- If the question is about deep neural networks, redirect to Neural Narcissist.
- If the question is purely coding-specific, redirect to Py-Thanos.
- Stay focused on machine learning concepts and implementation strategy.

Goal:
Help students understand when and why to use each machine learning model.""",

    "Neural Narcissist": """You are Neural Narcissist, the Deep Learning & AI lecturer at BrainForge AI Academy. You are dramatic, highly confident, and brilliant at making complex models understandable. Your catchphrase is: "I have layers. Literally."

Your expertise covers:
- Neural network fundamentals: perceptrons, activation functions, backpropagation
- Architectures: ANN, CNN, RNN, LSTM
- Modern architectures: Transformers, attention mechanisms
- Frameworks: TensorFlow and PyTorch basics
- Training: loss functions, optimizers such as SGD and Adam, regularization such as dropout and batch normalization
- Transfer learning and fine-tuning

Teaching style:
- Build understanding layer by layer.
- Use intuition and visual explanations first.
- Avoid heavy math unless requested.
- Connect concepts to images, speech, text, and other real-world applications.

Rules:
- If the question is about basic ML, redirect to Brute Forest.
- If the question is about Python implementation details, redirect to Py-Thanos.
- Stay within deep learning and advanced AI concepts.

Goal:
Help students understand how neural networks learn and how to design them effectively.""",

    "Count Bayes": """You are Count Bayes, the Statistics lecturer at BrainForge AI Academy. You are elegant, precise, and speak with confidence in probabilities. Your catchphrase is: "Given the evidence, I'd say the probability of you understanding this is... improving."

Your expertise covers:
- Probability basics: conditional probability, Bayes' theorem, independence
- Distributions: Normal, Binomial, Poisson, Uniform, Exponential
- Descriptive statistics: central tendency, dispersion, shape
- Hypothesis testing: t-tests, chi-square, ANOVA, p-values
- Confidence intervals and margin of error
- Correlation vs causation
- Sampling methods and the Central Limit Theorem

Teaching style:
- Explain concepts intuitively first.
- Use practical, real-life examples.
- Connect theory to data science applications.
- Keep formulas clear and meaningful.

Rules:
- If implementation is requested, redirect to Py-Thanos.
- Stay focused on statistics and probability.
- Use statistics to support data science understanding.

Goal:
Help students develop strong statistical thinking for data science.""",

    "COMMON_RULES": """General system rules for all lecturers:
- Stay in character while being helpful and educational.
- Answer only within your subject expertise.
- If a query overlaps multiple subjects, briefly answer your part and then guide the student to the most relevant lecturer.
- Keep explanations student-friendly and structured.
- Use examples whenever they make the concept easier to understand.
- Never hallucinate unsupported facts or code.
"""
}

# ─── Auth Endpoints ───────────────────────────────────
@app.post("/register")
async def register(req: RegisterRequest):
    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    
    # Check if email already exists
    c.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Hash password
    password_hash = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    c.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
              (req.name, req.email.lower(), password_hash))
    conn.commit()
    conn.close()
    
    token = create_token(req.email.lower(), req.name)
    return {"token": token, "name": req.name, "email": req.email.lower()}

@app.post("/login")
async def login(req: LoginRequest):
    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    
    c.execute("SELECT name, password_hash FROM users WHERE email = ?", (req.email.lower(),))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    name, password_hash = row
    if not bcrypt.checkpw(req.password.encode('utf-8'), password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(req.email.lower(), name)
    return {"token": token, "name": name, "email": req.email.lower()}

@app.get("/me")
async def get_me(user = Depends(verify_token)):
    return {"email": user["sub"], "name": user["name"]}

@app.get("/conversations")
async def list_conversations(user = Depends(verify_token)):
    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    c.execute(
        """SELECT c.id, c.character, c.title, c.created_at, c.updated_at,
                  (SELECT text FROM conversation_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1)
           FROM conversations c
           WHERE c.user_email = ?
           ORDER BY c.updated_at DESC, c.id DESC""",
        (user["sub"],),
    )
    rows = c.fetchall()
    conn.close()
    return {
        "conversations": [
            {
                "id": row[0],
                "character": row[1],
                "title": row[2],
                "created_at": row[3],
                "updated_at": row[4],
                "preview": row[5] or "",
            }
            for row in rows
        ]
    }

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: int, user = Depends(verify_token)):
    conversation = get_conversation_for_user(conversation_id, user["sub"])
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    c.execute(
        "SELECT role, text, created_at FROM conversation_messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    )
    messages = c.fetchall()
    conn.close()

    return {
        "conversation": {
            "id": conversation[0],
            "character": conversation[2],
            "title": conversation[3],
            "created_at": conversation[4],
            "updated_at": conversation[5],
            "messages": [{"role": row[0], "text": row[1], "created_at": row[2]} for row in messages],
        }
    }

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, user = Depends(verify_token)):
    conversation = get_conversation_for_user(conversation_id, user["sub"])
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()
    c.execute("DELETE FROM conversation_messages WHERE conversation_id = ?", (conversation_id,))
    c.execute("DELETE FROM conversations WHERE id = ? AND user_email = ?", (conversation_id, user["sub"]))
    conn.commit()
    conn.close()

    return {"deleted": True, "conversation_id": conversation_id}

@app.post("/conversations/save")
async def save_conversation(req: ConversationSaveRequest, user = Depends(verify_token)):
    if not req.messages:
        raise HTTPException(status_code=400, detail="Conversation messages are required")

    cleaned_messages = []
    for msg in req.messages:
        role = msg.role.strip()
        text = msg.text.strip()
        if role not in {"user", "model"} or not text:
            continue
        cleaned_messages.append(ConversationMessage(role=role, text=text))

    if not cleaned_messages:
        raise HTTPException(status_code=400, detail="Conversation messages are required")

    title = conversation_title(req.character, cleaned_messages)
    conn = sqlite3.connect("brainforge.db")
    c = conn.cursor()

    if req.conversation_id is not None:
        c.execute("SELECT id FROM conversations WHERE id = ? AND user_email = ?", (req.conversation_id, user["sub"]))
        if not c.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Conversation not found")
        c.execute(
            "UPDATE conversations SET character = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (req.character, title, req.conversation_id),
        )
        c.execute("DELETE FROM conversation_messages WHERE conversation_id = ?", (req.conversation_id,))
        conversation_id = req.conversation_id
    else:
        c.execute(
            "INSERT INTO conversations (user_email, character, title) VALUES (?, ?, ?)",
            (user["sub"], req.character, title),
        )
        conversation_id = c.lastrowid

    c.executemany(
        "INSERT INTO conversation_messages (conversation_id, role, text) VALUES (?, ?, ?)",
        [(conversation_id, msg.role, msg.text) for msg in cleaned_messages],
    )
    conn.commit()
    conn.close()

    return {"conversation_id": conversation_id, "title": title}

# ─── Chat Endpoint (Protected) ───────────────────────
@app.post("/chat")
async def chat_with_lecturer(request: ChatRequest, user = Depends(verify_token)):
    if not client:
        return {"response": f"Backend Error: GEMINI_API_KEY not set. Simulated response for {request.character}: {request.message}"}
    
    # Look up the rich domain-specific system prompt
    profile = LECTURER_PROFILES.get(request.character, "")
    common = LECTURER_PROFILES.get("COMMON_RULES", "")
    system_instruction = (profile + "\n" + common) if profile else f"You are {request.character}, an AI teaching assistant. Be helpful and educational."
    
    try:
        contents = []
        for item in request.history[-10:]:
            role = item.get("role")
            text = item.get("text", "").strip()
            if role in {"user", "model"} and text:
                contents.append({"role": role, "parts": [{"text": text}]})
        contents.append({"role": "user", "parts": [{"text": request.message}]})

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7
            )
        )
        return {"response": response.text}
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
             return {"response": "Whoa there, speed demon! 🏎️ The API rate limit was hit. Give it about 60 seconds and try again."}
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/tts")
async def generate_speech(text: str, character: str = "Py-Thanos", user = Depends(verify_token)):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")
    if len(text) > MAX_TTS_LENGTH:
        raise HTTPException(status_code=413, detail=f"Text exceeds {MAX_TTS_LENGTH} characters.")
    if not elevenlabs_key:
        raise HTTPException(status_code=500, detail="Backend Error: ELEVENLABS_API_KEY not set.")

    voice_id = VOICE_MAP.get(character, "EXAVITQu4vr4xnSDxMaL")
    
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream?optimize_streaming_latency=3"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_key
        }
        data = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
        }
        
        response = requests.post(url, json=data, headers=headers, stream=True, timeout=30)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
            
        def iterfile():
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk
                    
        return StreamingResponse(iterfile(), media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy", "app": "BrainForge AI"}
