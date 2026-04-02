# 🧠 BrainForge AI — Data Science Academy

An AI-powered virtual teaching system where **8 specialized AI lecturers** help you master Data Science through interactive, voice-enabled conversations.

Each lecturer is a domain expert powered by **Google Gemini** with role-based prompting, and speaks to you using **ElevenLabs** text-to-speech.

---

## 🎓 Meet the Lecturers

| Lecturer | Subject | Catchphrase |
|---|---|---|
| **Py-Thanos** | Python Programming | *"Perfectly balanced, as all code should be"* |
| **SQL-ock Holmes** | SQL & Databases | *"Elementary, my dear student — it's a LEFT JOIN"* |
| **Excel-ibur** | Excel & Business Analytics | *"Give me a spreadsheet, and I shall move the world"* |
| **Scatter-Brain** | EDA & Visualization | *"Every dataset has a story — I just read the scatter plots"* |
| **Power BI-otch** | Power BI & Reporting | *"If your dashboard doesn't tell a story, it's just noise"* |
| **Brute Forest** | Machine Learning | *"In the forest of algorithms, only the fittest model survives"* |
| **Neural Narcissist** | Deep Learning & AI | *"I have layers. Literally."* |
| **Count Bayes** | Statistics | *"The probability of you understanding this is... improving"* |

Each lecturer stays within their domain and **cross-references** other lecturers when a question falls outside their expertise.

---

## ✨ Key Features

- **8 Domain-Expert AI Lecturers** — Deep system prompts with bounded expertise and personality
- **Voice Narration (Optional)** — Toggle TTS on/off; responses are detailed with code examples
- **Code Block Rendering** — Proper syntax highlighting for Python, SQL, and more
- **Thinking Indicator** — Animated dots while the AI generates a response
- **Session Persistence** — Stay logged in across browser refreshes
- **Glassmorphic UI** — Premium dark theme ("Ethereal Obsidian") with neon accents
- **Speech-to-Text** — Ask questions via microphone (Chrome/Edge)
- **Cross-Referencing** — Lecturers redirect you to the right expert when needed

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, Tailwind CSS, Vanilla JS |
| Backend | Python, FastAPI, Uvicorn |
| AI Model | Google Gemini 2.5 Flash |
| Voice | ElevenLabs TTS (streaming) |
| Design | Stitch MCP (Ethereal Obsidian theme) |

---

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd shitt
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r backend/requirements.txt
```

### 2. Configure API Keys

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

- **Gemini API Key**: Get one free at [Google AI Studio](https://aistudio.google.com/apikey)
- **ElevenLabs API Key**: Get one free at [ElevenLabs](https://elevenlabs.io) (Settings → API Keys)

### 3. Run

```bash
uvicorn backend.main:app --port 8000 --reload
```

Open `frontend/index.html` in your browser (or serve the `frontend/` folder via any local server).

---

## Project Structure

```
├── .env                       # API keys (not committed)
├── backend/
│   ├── main.py               # Backend — FastAPI, Gemini prompts, TTS streaming
│   ├── requirements.txt      # Python dependencies
│   └── test_app.py           # Backend tests
├── frontend/
│   ├── index.html            # Frontend — UI shell, screens, Tailwind config
│   └── script.js             # Frontend — Lecturer logic, chat engine, voice toggle
└── README.md                 # This file
```

---

##  Dependencies

```
fastapi
uvicorn
google-genai
pydantic
python-dotenv
elevenlabs
requests
```

---

##  How It Works

1. **Login** → Session saved in `localStorage` (persists across refreshes)
2. **Pick a Lecturer** → Each card shows the lecturer's name, subject, and expertise
3. **Ask a Question** → Gemini generates a domain-specific response using a rich system prompt
4. **Voice (Optional)** → ElevenLabs streams the response as audio; toggle on/off anytime
5. **Cross-Referencing** → If your question is out-of-scope, the lecturer redirects you

---

##  License

This project is for educational purposes.
