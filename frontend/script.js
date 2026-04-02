let isLoginMode = true;
let selectedLecturer = "";
let selectedLecturerImg = "";
let selectedLecturerSubject = "";
let voiceEnabled = true;
let availableSpeechVoices = [];
let currentVoiceProvider = 'ElevenLabs';
let currentVoiceDetail = 'Preferred provider';
let lastSpokenResponseText = '';

const microsoftVoicePreferences = {
    "Py-Thanos": [
        "Microsoft Guy Online (Natural) - English (United States)",
        "Microsoft Guy - English (United States)"
    ],
    "SQL-ock Holmes": [
        "Microsoft Ryan Online (Natural) - English (United Kingdom)",
        "Microsoft Ryan - English (United Kingdom)"
    ],
    "Excel-ibur": [
        "Microsoft Davis Online (Natural) - English (United States)",
        "Microsoft Davis - English (United States)"
    ],
    "Scatter-Brain": [
        "Microsoft Jason Online (Natural) - English (United States)",
        "Microsoft Jason - English (United States)"
    ],
    "Power BI-otch": [
        "Microsoft Jenny Online (Natural) - English (United States)",
        "Microsoft Jenny - English (United States)"
    ],
    "Brute Forest": [
        "Microsoft Tony Online (Natural) - English (United States)",
        "Microsoft Tony - English (United States)"
    ],
    "Neural Narcissist": [
        "Microsoft Aria Online (Natural) - English (United States)",
        "Microsoft Aria - English (United States)"
    ],
    "Count Bayes": [
        "Microsoft Sonia Online (Natural) - English (United Kingdom)",
        "Microsoft Sonia - English (United Kingdom)"
    ]
};

const lecturers = [
    {
        name: "Py-Thanos",
        subject: "Python Programming",
        description: "Core Python, NumPy, Pandas, OOP & Data Wrangling",
        icon: "code",
        color: "#3776AB",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=PyThanos&backgroundColor=3776AB"
    },
    {
        name: "SQL-ock Holmes",
        subject: "SQL & Databases",
        description: "Queries, Joins, CTEs, Window Functions & Optimization",
        icon: "storage",
        color: "#E48900",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=SQLHolmes&backgroundColor=E48900"
    },
    {
        name: "Excel-ibur",
        subject: "Excel & Business Analytics",
        description: "Formulas, Pivot Tables, Power Query & Dashboards",
        icon: "table_chart",
        color: "#217346",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=Excelibur&backgroundColor=217346"
    },
    {
        name: "Scatter-Brain",
        subject: "EDA & Visualization",
        description: "Data Cleaning, Statistics, Distributions & Plotting",
        icon: "scatter_plot",
        color: "#E63946",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=ScatterBrain&backgroundColor=E63946"
    },
    {
        name: "Power BI-otch",
        subject: "Power BI & Reporting",
        description: "DAX, Data Modeling, Dashboards & Business Stories",
        icon: "bar_chart",
        color: "#F2C811",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=PowerBIotch&backgroundColor=F2C811"
    },
    {
        name: "Brute Forest",
        subject: "Machine Learning",
        description: "Regression, Classification, Clustering & Pipelines",
        icon: "model_training",
        color: "#6A0DAD",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=BruteForest&backgroundColor=6A0DAD"
    },
    {
        name: "Neural Narcissist",
        subject: "Deep Learning & AI",
        description: "ANNs, CNNs, RNNs, Transformers & TensorFlow/PyTorch",
        icon: "psychology",
        color: "#FF6F61",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=NeuralNarcissist&backgroundColor=FF6F61"
    },
    {
        name: "Count Bayes",
        subject: "Statistics",
        description: "Probability, Distributions, Hypothesis Testing & Inference",
        icon: "functions",
        color: "#1D3557",
        img: "https://api.dicebear.com/7.x/bottts/svg?seed=CountBayes&backgroundColor=1D3557"
    }
];

// ─── Auth ────────────────────────────────────────────
const API = "https://brainforge-ai-virtual-assistant.onrender.com";
let authToken = localStorage.getItem('authToken');
let currentUserEmail = localStorage.getItem('currentUserEmail') || '';
let currentConversationId = null;
let currentConversationTitle = '';

document.addEventListener('DOMContentLoaded', () => {
    loadSpeechVoices();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadSpeechVoices;
    }
    checkAuth();
});

function loadSpeechVoices() {
    if (!('speechSynthesis' in window)) return;
    availableSpeechVoices = window.speechSynthesis.getVoices();
}

function updateVoiceProviderLabel(provider, detail) {
    currentVoiceProvider = provider;
    currentVoiceDetail = detail;

    const providerLabel = document.getElementById('voice-provider-label');
    if (providerLabel) providerLabel.innerText = provider;

    const providerDetail = document.getElementById('voice-provider-detail');
    if (providerDetail) providerDetail.innerText = detail;

    const desktopBadge = document.getElementById('voice-provider-badge-desktop');
    if (desktopBadge) desktopBadge.innerText = provider;

    const desktopBadgeDetail = document.getElementById('voice-provider-badge-detail-desktop');
    if (desktopBadgeDetail) desktopBadgeDetail.innerText = detail;

    const mobileBadge = document.getElementById('voice-provider-badge-mobile');
    if (mobileBadge) mobileBadge.innerText = provider;

    const mobileBadgeDetail = document.getElementById('voice-provider-badge-detail-mobile');
    if (mobileBadgeDetail) mobileBadgeDetail.innerText = detail;
}

function scrollToMessageStart(element) {
    if (!element) return;
    requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function localSessionKey() {
    return currentUserEmail ? `brainforge-active-session:${currentUserEmail}` : 'brainforge-active-session';
}

function serializeActiveSession() {
    if (!selectedLecturer || !chatHistory.length) return null;
    return {
        conversationId: currentConversationId,
        title: currentConversationTitle,
        character: selectedLecturer,
        messages: chatHistory,
        savedAt: new Date().toISOString()
    };
}

function persistLocalSession() {
    const payload = serializeActiveSession();
    if (!payload) return;
    localStorage.setItem(localSessionKey(), JSON.stringify(payload));
}

function clearLocalSession() {
    localStorage.removeItem(localSessionKey());
}

function renderSessionBanner(label) {
    const historyEl = document.getElementById('chat-history');
    historyEl.innerHTML = `
        <div class="flex justify-center mt-4">
            <span class="px-5 py-2 rounded-md bg-surface-container text-[10px] uppercase tracking-[0.2em] text-primary font-label font-semibold text-center">
                ${label}
            </span>
        </div>
    `;
}

function renderChatMessages(messages) {
    const historyEl = document.getElementById('chat-history');
    messages.forEach((entry) => {
        if (entry.role === 'user') {
            historyEl.innerHTML += `
                <div class="flex items-start justify-end gap-3 md:gap-4 max-w-4xl ml-auto mb-6">
                    <div class="bg-primary-container/30 rounded-lg rounded-tr-none p-5 md:p-6" style="box-shadow: 0 4px 16px rgba(3,14,32,0.3);">
                        <p class="leading-relaxed text-primary-fixed text-base font-body">${escapeHtml(entry.text)}</p>
                    </div>
                    <div class="w-10 h-10 rounded-md glass-panel flex-shrink-0 flex items-center justify-center bg-surface-container-high overflow-hidden">
                        <span class="material-symbols-outlined text-primary text-xl">person</span>
                    </div>
                </div>
            `;
        } else {
            historyEl.innerHTML += `
                <div class="flex items-start gap-3 md:gap-4 max-w-4xl mb-6">
                    <div class="w-10 h-10 rounded-md flex-shrink-0 overflow-hidden bg-surface-container-high" style="box-shadow: 0 0 12px rgba(255,185,85,0.15);">
                        <img src="${selectedLecturerImg}" class="w-full h-full object-cover">
                    </div>
                    <div class="bg-surface-container-low rounded-lg rounded-tl-none p-5 md:p-6 relative overflow-hidden flex-1" style="box-shadow: 0 8px 32px rgba(3,14,32,0.4);">
                        <div class="leading-relaxed text-on-surface text-base font-body">${renderReadableMarkdown(entry.text)}</div>
                    </div>
                </div>
            `;
        }
    });
}

function applyLecturerSelection(lecturer) {
    selectedLecturer = lecturer.name;
    selectedLecturerImg = lecturer.img;
    selectedLecturerSubject = lecturer.subject;
    document.getElementById('chat-char-name').innerText = lecturer.name;
    document.getElementById('chat-char-trait').innerText = lecturer.subject;
    document.getElementById('chat-avatar').src = lecturer.img;
    document.getElementById('user-input').placeholder = `Ask ${lecturer.name} about ${lecturer.subject}...`;
}

function getLecturerByName(name) {
    return lecturers.find((lec) => lec.name === name) || null;
}

async function checkAuth() {
    if (!authToken) {
        navigateTo('auth-screen');
        return;
    }
    // Verify token is still valid with backend
    try {
        const res = await fetch(`${API}/me`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (res.ok) {
            const user = await res.json();
            currentUserEmail = user.email;
            localStorage.setItem('currentUserEmail', currentUserEmail);
            showUserGreeting(user.name);
            navigateTo('selection-screen');
            await loadConversationHistoryList();
            restoreLocalSession();
        } else {
            // Token expired or invalid
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUserEmail');
            authToken = null;
            currentUserEmail = '';
            navigateTo('auth-screen');
        }
    } catch {
        // Backend offline — still allow if token exists
        navigateTo('selection-screen');
    }
}

function showUserGreeting(name) {
    const el = document.getElementById('user-greeting');
    if (el) el.innerText = name;
}

function setActiveHeaderTab(screenId) {
    const lecturerTab = document.getElementById('header-tab-lecturers');
    const historyTab = document.getElementById('header-tab-history');

    if (lecturerTab) {
        lecturerTab.classList.toggle('text-primary', screenId === 'selection-screen');
        lecturerTab.classList.toggle('text-on-surface-variant', screenId !== 'selection-screen');
    }

    if (historyTab) {
        historyTab.classList.toggle('text-primary', screenId === 'history-screen');
        historyTab.classList.toggle('text-on-surface-variant', screenId !== 'history-screen');
    }
}

function showAuthError(msg) {
    let errEl = document.getElementById('auth-error');
    if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'auth-error';
        errEl.className = 'text-error text-sm text-center font-bold mt-2 px-2 py-2 rounded-lg bg-error-container/20 border border-error/20';
        document.getElementById('auth-form').appendChild(errEl);
    }
    errEl.innerText = msg;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 5000);
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const nameField = document.getElementById('reg-name-field');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleMsg = document.getElementById('auth-toggle-msg');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    // Hide error on toggle
    const errEl = document.getElementById('auth-error');
    if (errEl) errEl.classList.add('hidden');

    if (isLoginMode) {
        nameField.classList.add('hidden');
        document.getElementById('auth-name').required = false;
        submitBtn.innerText = 'Sign In';
        toggleMsg.innerText = "Don't have an account?";
        toggleBtn.innerText = 'Create Account';
    } else {
        nameField.classList.remove('hidden');
        document.getElementById('auth-name').required = true;
        submitBtn.innerText = 'Register';
        toggleMsg.innerText = 'Already have an account?';
        toggleBtn.innerText = 'Sign In';
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');

    // Client-side validation
    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = isLoginMode ? 'Signing In...' : 'Registering...';

    try {
        const endpoint = isLoginMode ? '/login' : '/register';
        const body = isLoginMode
            ? { email, password }
            : { name: document.getElementById('auth-name').value.trim(), email, password };

        const res = await fetch(`${API}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (!res.ok) {
            const msg = data.detail || 'Authentication failed';
            showAuthError(typeof msg === 'string' ? msg : JSON.stringify(msg));
            return;
        }

        // Success — store JWT token
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        currentUserEmail = data.email;
        localStorage.setItem('currentUserEmail', currentUserEmail);
        showUserGreeting(data.name);

        // Reset fields
        document.getElementById('auth-password').value = '';
        document.getElementById('auth-email').value = '';

        navigateTo('selection-screen');
        await loadConversationHistoryList();
    } catch (err) {
        showAuthError('Cannot reach the server. Is the backend running?');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isLoginMode ? 'Sign In' : 'Register';
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUserEmail');
    clearLocalSession();
    authToken = null;
    currentUserEmail = '';
    currentConversationId = null;
    currentConversationTitle = '';
    selectedLecturer = "";
    chatHistory = [];
    navigateTo('auth-screen');
}

function openLecturerSession(lecturerName, options = {}) {
    const lecturer = getLecturerByName(lecturerName);
    if (!lecturer) return;

    applyLecturerSelection(lecturer);
    updateVoiceProviderLabel('ElevenLabs', lecturer.name);
    currentConversationId = options.conversationId ?? null;
    currentConversationTitle = options.title ?? '';
    chatHistory = (options.messages || []).map((entry) => ({ role: entry.role, text: entry.text }));

    const bannerLabel = currentConversationTitle
        ? `${lecturer.name} — ${currentConversationTitle}`
        : `${lecturer.name} — ${lecturer.subject} — Session Started`;
    renderSessionBanner(bannerLabel);
    if (chatHistory.length) {
        renderChatMessages(chatHistory);
    }

    if (chatHistory.length) {
        persistLocalSession();
    } else {
        clearLocalSession();
    }
    navigateTo('chat-screen');
}

function restoreLocalSession() {
    const stored = localStorage.getItem(localSessionKey());
    if (!stored) return;
    try {
        const session = JSON.parse(stored);
        if (!session?.character || !Array.isArray(session.messages) || !session.messages.length) return;
        openLecturerSession(session.character, {
            conversationId: session.conversationId ?? null,
            title: session.title || 'Recovered Session',
            messages: session.messages
        });
    } catch (error) {
        console.warn('Could not restore local session:', error);
    }
}

async function loadConversationHistoryList() {
    const list = document.getElementById('conversation-history-list');
    if (!list) return;
    if (!authToken) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = `
        <div class="col-span-full rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant font-body">
            Loading conversation history...
        </div>
    `;

    const localSession = serializeActiveSession();
    const items = [];
    if (localSession) {
        items.push({
            id: localSession.conversationId ? `local-${localSession.conversationId}` : 'local-active',
            conversationId: localSession.conversationId || null,
            character: localSession.character,
            title: localSession.title || 'Current in-progress session',
            preview: localSession.messages[localSession.messages.length - 1]?.text || '',
            local: true,
            messages: localSession.messages
        });
    }

    try {
        const res = await fetch(`${API}/conversations`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error(`History request failed with status ${res.status}`);
        const data = await res.json();
        const remoteItems = data.conversations || [];
        const dedupedRemote = remoteItems.filter((item) => !(localSession && localSession.conversationId === item.id));
        items.push(...dedupedRemote);
    } catch (error) {
        console.warn('Could not load remote conversation history:', error);
    }

    if (!items.length) {
        list.innerHTML = `
            <div class="col-span-full rounded-lg bg-surface-container p-4 text-sm text-on-surface-variant font-body">
                No saved sessions yet. Start a conversation and it will appear here.
            </div>
        `;
        return;
    }

    list.innerHTML = '';
    items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'glass-panel rounded-lg p-4 hover:bg-surface-container-high transition-all';
        const preview = escapeHtml((item.preview || '').slice(0, 110));
        card.innerHTML = `
            <div class="flex items-center justify-between gap-3 mb-2">
                <span class="text-xs font-label font-semibold uppercase tracking-[0.15em] text-primary">${item.character}</span>
                <span class="text-[10px] font-label font-semibold uppercase tracking-[0.15em] text-on-surface-variant">${item.local ? 'In Progress' : 'Saved'}</span>
            </div>
            <div class="text-sm font-body font-bold text-on-surface mb-2">${escapeHtml(item.title || 'Untitled session')}</div>
            <div class="text-xs font-body text-on-surface-variant leading-relaxed mb-4">${preview || 'Open to continue this session.'}</div>
            <div class="flex items-center gap-3">
                <button type="button" class="history-open-btn flex-1 px-4 py-2 rounded-md bg-primary/15 text-primary text-xs font-label font-semibold uppercase tracking-[0.15em] hover:bg-primary/20 transition-all">Open</button>
                <button type="button" class="history-delete-btn px-4 py-2 rounded-md bg-error/10 text-error text-xs font-label font-semibold uppercase tracking-[0.15em] hover:bg-error/15 transition-all">Delete</button>
            </div>
        `;

        const openButton = card.querySelector('.history-open-btn');
        if (openButton) {
            openButton.onclick = async () => {
                if (item.local) {
                    openLecturerSession(item.character, {
                        conversationId: item.conversationId || currentConversationId,
                        title: item.title,
                        messages: item.messages
                    });
                    return;
                }

                try {
                    const res = await fetch(`${API}/conversations/${item.id}`, {
                        headers: { "Authorization": `Bearer ${authToken}` }
                    });
                    if (!res.ok) throw new Error(`Conversation load failed with status ${res.status}`);
                    const data = await res.json();
                    openLecturerSession(data.conversation.character, {
                        conversationId: data.conversation.id,
                        title: data.conversation.title,
                        messages: data.conversation.messages
                    });
                } catch (error) {
                    console.warn('Could not open conversation:', error);
                }
            };
        }

        const deleteButton = card.querySelector('.history-delete-btn');
        if (deleteButton) {
            deleteButton.onclick = async () => {
                const label = item.title || 'this session';
                if (!window.confirm(`Delete "${label}"?`)) return;

                try {
                    const targetConversationId = item.local ? item.conversationId : item.id;
                    if (targetConversationId) {
                        const res = await fetch(`${API}/conversations/${targetConversationId}`, {
                            method: 'DELETE',
                            headers: { "Authorization": `Bearer ${authToken}` }
                        });
                        if (!res.ok && res.status !== 404) {
                            throw new Error(`Conversation delete failed with status ${res.status}`);
                        }
                    }

                    if (item.local || currentConversationId === targetConversationId) {
                        clearLocalSession();
                        currentConversationId = null;
                        currentConversationTitle = '';
                        chatHistory = [];

                        if (document.getElementById('chat-screen')?.classList.contains('active')) {
                            navigateTo('selection-screen');
                        }
                    }

                    await loadConversationHistoryList();
                } catch (error) {
                    console.warn('Could not delete conversation:', error);
                }
            };
        }
        list.appendChild(card);
    });
}

async function saveConversationToServer() {
    if (!authToken || !selectedLecturer || !chatHistory.length) return;
    try {
        const res = await fetch(`${API}/conversations/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                character: selectedLecturer,
                messages: chatHistory
            })
        });
        if (!res.ok) throw new Error(`Save failed with status ${res.status}`);
        const data = await res.json();
        currentConversationId = data.conversation_id;
        currentConversationTitle = data.title;
        persistLocalSession();
        await loadConversationHistoryList();
    } catch (error) {
        console.warn('Could not save conversation history:', error);
    }
}

// ─── Navigation ──────────────────────────────────────
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
        s.classList.add('hidden');
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
        target.classList.add('active');
    }

    const header = document.getElementById('main-header');
    if (header) {
        if (screenId === 'auth-screen') {
            header.classList.add('hidden');
        } else {
            header.classList.remove('hidden');
        }
    }

    setActiveHeaderTab(screenId);

    if (screenId === 'selection-screen') {
        loadLecturers();
        loadConversationHistoryList();
    } else if (screenId === 'history-screen') {
        loadConversationHistoryList();
    }
}

// ─── Lecturer Cards ──────────────────────────────────
function loadLecturers() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    grid.innerHTML = "";

    lecturers.forEach(lec => {
        const card = document.createElement('div');
        card.className = "glass-card rounded-lg p-5 group cursor-pointer hover:scale-[1.02] transition-all duration-500 flex flex-col relative overflow-hidden amber-glow";
        card.style.boxShadow = '0 8px 32px rgba(3,14,32,0.4)';
        card.onmouseenter = () => { card.style.boxShadow = '0 12px 48px rgba(255,185,85,0.12)'; };
        card.onmouseleave = () => { card.style.boxShadow = '0 8px 32px rgba(3,14,32,0.4)'; };
        card.onclick = () => {
            selectedLecturer = lec.name;
            selectedLecturerImg = lec.img;
            selectedLecturerSubject = lec.subject;
            chatHistory = [];

            document.getElementById('chat-char-name').innerText = lec.name;
            document.getElementById('chat-char-trait').innerText = lec.subject;
            document.getElementById('chat-avatar').src = lec.img;
            document.getElementById('user-input').placeholder = `Ask ${lec.name} about ${lec.subject}...`;

            document.getElementById('chat-history').innerHTML = `
                <div class="flex justify-center mt-4">
                    <span class="px-5 py-2 rounded-md bg-surface-container text-[10px] uppercase tracking-[0.2em] text-primary font-label font-semibold text-center">
                        ${lec.name} — ${lec.subject} — Session Started
                    </span>
                </div>
            `;
            navigateTo('chat-screen');
        };
        card.innerHTML = `
            <div class="relative w-full aspect-[4/5] rounded-md overflow-hidden mb-5 bg-surface-container flex items-center justify-center" style="background: linear-gradient(135deg, ${lec.color}15, ${lec.color}05);">
                <img src="${lec.img}" class="w-3/4 h-3/4 object-contain transition-transform duration-700 group-hover:scale-110 drop-shadow-lg">
                <div class="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-50"></div>
                <div class="absolute top-3 right-3">
                    <span class="material-symbols-outlined text-3xl drop-shadow" style="color: ${lec.color}; font-variation-settings: 'wght' 200;">${lec.icon}</span>
                </div>
                <div class="absolute bottom-3 left-3">
                    <span class="px-3 py-1 rounded-sm text-[9px] font-label font-semibold uppercase tracking-[0.15em]" style="background: ${lec.color}25; color: ${lec.color};">
                        ${lec.subject}
                    </span>
                </div>
            </div>
            <h2 class="text-lg font-headline font-bold text-on-surface mb-1 tracking-tight group-hover:text-primary transition-colors duration-300">${lec.name}</h2>
            <p class="text-xs text-on-surface-variant font-body leading-relaxed">${lec.description}</p>
        `;
        card.onclick = () => {
            openLecturerSession(lec.name, { messages: [] });
        };
        grid.appendChild(card);
    });
}

// ─── Speech Recognition ──────────────────────────────
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (window.SpeechRecognition) {
    recognition = new window.SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        document.getElementById('mic-btn').querySelector('span').innerText = "graphic_eq";
        document.getElementById('mic-btn').classList.add('animate-pulse', 'bg-primary/20', 'shadow-[0_0_15px_rgba(255,185,85,0.3)]');
    };
    recognition.onresult = (e) => {
        document.getElementById('user-input').value = e.results[0][0].transcript;
        resetMic();
        sendQuery();
    };
    recognition.onerror = () => resetMic();
    recognition.onend = () => resetMic();
}

function resetMic() {
    const btn = document.getElementById('mic-btn');
    btn.querySelector('span').innerText = "mic";
    btn.classList.remove('animate-pulse', 'bg-primary/20', 'shadow-[0_0_15px_rgba(255,185,85,0.3)]');
}

function startListening() {
    if (recognition) {
        recognition.start();
    } else {
        alert("Speech Recognition not supported (try Chrome/Edge).");
    }
}

// ─── Voice Toggle ────────────────────────────────────
function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    syncVoiceButtons();
    // Stop any currently playing audio
    if (!voiceEnabled) {
        if (window.currentAudio) window.currentAudio.pause();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } else if (window.currentAudio && window.currentAudio.paused) {
        window.currentAudio.play().catch(() => {
            if (lastSpokenResponseText) speakText(lastSpokenResponseText);
        });
    } else if (lastSpokenResponseText) {
        speakText(lastSpokenResponseText);
    }
}

function syncVoiceButtons() {
    ['voice-toggle', 'voice-toggle-mobile'].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const icon = btn.querySelector('span');
        if (icon) icon.innerText = voiceEnabled ? 'volume_up' : 'volume_off';
        btn.title = voiceEnabled ? 'Voice On (click to mute)' : 'Voice Off (click to unmute)';
    });

    const desktopLabel = document.getElementById('voice-toggle-label');
    if (desktopLabel) {
        desktopLabel.innerText = voiceEnabled ? 'Mute Voice' : 'Unmute Voice';
    }

    const mobileLabel = document.getElementById('voice-toggle-mobile-label');
    if (mobileLabel) {
        mobileLabel.innerText = voiceEnabled ? 'Mute' : 'Unmute';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applyInlineMarkdown(text) {
    return text
        .replace(/`([^`]+)`/g, '<code class="bg-surface-container-lowest text-primary px-2 py-0.5 rounded-sm text-sm font-mono">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b class="text-primary">$1</b>')
        .replace(/\*([^*]+)\*/g, '<i class="text-tertiary">$1</i>');
}

// ─── Text Formatting ─────────────────────────────────
function formatForSpeech(text) {
    return text.replace(/[*_#~`]/g, " ").replace(/```[\s\S]*?```/g, " code block omitted ").replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
}

function renderReadableMarkdown(text) {
    const escaped = escapeHtml(text).replace(/\r\n/g, '\n');
    const lines = escaped.split('\n');
    const html = [];
    let inCodeBlock = false;
    let codeLines = [];
    let listType = null;
    let listItems = [];
    let paragraphLines = [];
    let tableRows = [];

    function flushParagraph() {
        if (!paragraphLines.length) return;
        html.push(`<p class="my-3 leading-relaxed">${applyInlineMarkdown(paragraphLines.join('<br>'))}</p>`);
        paragraphLines = [];
    }

    function flushList() {
        if (!listItems.length) return;
        const items = listItems.map((item) => `<li class="ml-5 pl-1 py-1">${applyInlineMarkdown(item)}</li>`).join('');
        const tag = listType === 'ol' ? 'ol' : 'ul';
        const extraClass = tag === 'ol' ? 'list-decimal' : 'list-disc';
        html.push(`<${tag} class="${extraClass} my-3 space-y-1">${items}</${tag}>`);
        listType = null;
        listItems = [];
    }

    function flushCodeBlock() {
        if (!codeLines.length) return;
        html.push(`<pre class="bg-surface-container-lowest rounded-md p-4 my-3 overflow-x-auto text-sm font-mono text-primary-fixed"><code>${codeLines.join('\n')}</code></pre>`);
        codeLines = [];
    }

    function isMarkdownTableLine(value) {
        return value.includes('|') && /^\|?.+\|.+\|?$/.test(value);
    }

    function isMarkdownTableSeparator(value) {
        const normalized = value.replace(/\s/g, '');
        return /^\|?[:\-|]+\|?$/.test(normalized) && normalized.includes('-');
    }

    function parseTableCells(value) {
        return value
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => applyInlineMarkdown(cell.trim()));
    }

    function flushTable() {
        if (!tableRows.length) return;
        const [headerRow, ...bodyRows] = tableRows;
        const headerHtml = `<tr>${headerRow.map((cell) => `<th class="px-3 py-2 text-left font-semibold text-primary border-b border-surface-container-high">${cell}</th>`).join('')}</tr>`;
        const bodyHtml = bodyRows.map((row) => `<tr>${row.map((cell) => `<td class="px-3 py-2 align-top border-b border-surface-container-low">${cell}</td>`).join('')}</tr>`).join('');
        html.push(`
            <div class="my-4 overflow-x-auto">
                <table class="min-w-full text-sm font-body bg-surface-container-low rounded-md overflow-hidden">
                    <thead>${headerHtml}</thead>
                    <tbody>${bodyHtml}</tbody>
                </table>
            </div>
        `);
        tableRows = [];
    }

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            flushParagraph();
            flushList();
            flushTable();
            if (inCodeBlock) {
                flushCodeBlock();
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        if (!trimmed) {
            flushParagraph();
            flushList();
            flushTable();
            continue;
        }

        if (/^---+$/.test(trimmed)) {
            flushParagraph();
            flushList();
            flushTable();
            html.push('<hr class="border-surface-container-high my-3">');
            continue;
        }

        if (/^#{1,3}\s+/.test(trimmed)) {
            flushParagraph();
            flushList();
            flushTable();
            const level = trimmed.match(/^#+/)[0].length;
            const content = applyInlineMarkdown(trimmed.replace(/^#{1,3}\s+/, ''));
            const classes = {
                1: 'text-xl font-headline font-bold text-primary mt-4 mb-2',
                2: 'text-lg font-headline font-bold text-primary mt-4 mb-2',
                3: 'text-base font-headline font-bold text-primary mt-4 mb-2'
            };
            html.push(`<div class="${classes[level]}">${content}</div>`);
            continue;
        }

        if (trimmed.startsWith('&gt; ')) {
            flushParagraph();
            flushList();
            flushTable();
            html.push(`<div class="border-l-2 border-primary pl-4 py-2 my-2 text-on-surface-variant italic">${applyInlineMarkdown(trimmed.slice(5))}</div>`);
            continue;
        }

        if (isMarkdownTableLine(trimmed)) {
            flushParagraph();
            flushList();
            if (isMarkdownTableSeparator(trimmed)) {
                continue;
            }
            tableRows.push(parseTableCells(trimmed));
            continue;
        }

        const unorderedMatch = trimmed.match(/^[-*]\s+(.+)/);
        if (unorderedMatch) {
            flushParagraph();
            flushTable();
            if (listType && listType !== 'ul') flushList();
            listType = 'ul';
            listItems.push(unorderedMatch[1]);
            continue;
        }

        const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (orderedMatch) {
            flushParagraph();
            flushTable();
            if (listType && listType !== 'ol') flushList();
            listType = 'ol';
            listItems.push(orderedMatch[2]);
            continue;
        }

        flushList();
        flushTable();
        paragraphLines.push(trimmed);
    }

    flushParagraph();
    flushList();
    flushTable();
    if (inCodeBlock) flushCodeBlock();

    return html.join('');
}

// ─── TTS ─────────────────────────────────────────────
function pickMicrosoftVoice() {
    if (!availableSpeechVoices.length) loadSpeechVoices();

    const preferredNames = microsoftVoicePreferences[selectedLecturer] || [];
    for (const name of preferredNames) {
        const exactMatch = availableSpeechVoices.find((voice) => voice.name === name);
        if (exactMatch) return exactMatch;
    }

    const microsoftEnglishVoice = availableSpeechVoices.find((voice) =>
        voice.name.toLowerCase().includes('microsoft') && voice.lang.toLowerCase().startsWith('en')
    );
    if (microsoftEnglishVoice) return microsoftEnglishVoice;

    return availableSpeechVoices.find((voice) => voice.lang.toLowerCase().startsWith('en')) || null;
}

function speakWithBrowserTTS(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanedText = formatForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    const preferredVoice = pickMicrosoftVoice();
    if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
        updateVoiceProviderLabel('Microsoft / Browser', preferredVoice.name);
    } else {
        updateVoiceProviderLabel('Browser TTS', 'Default local voice');
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
}

async function speakText(text) {
    if (!voiceEnabled) return;
    if (!authToken) return;
    lastSpokenResponseText = text;

    // Stop any currently playing audio
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    const cleanedText = formatForSpeech(text);

    try {
        updateVoiceProviderLabel('ElevenLabs', selectedLecturer || 'Remote voice');
        const url = `${API}/tts?text=${encodeURIComponent(cleanedText)}&character=${encodeURIComponent(selectedLecturer)}`;
        const response = await fetch(url, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error(`TTS request failed with status ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        window.currentAudio = new Audio(audioUrl);
        window.currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            window.currentAudio = null;
        };
        window.currentAudio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            console.warn("ElevenLabs TTS error, falling back to Microsoft/browser TTS");
            speakWithBrowserTTS(text);
        };
        await window.currentAudio.play();
    } catch (error) {
        console.warn("ElevenLabs TTS error, falling back to Microsoft/browser TTS:", error);
        speakWithBrowserTTS(text);
    }
}

// ─── Utilities ───────────────────────────────────────
function handleKey(e) {
    if (e.key === 'Enter') sendQuery();
}

setInterval(() => {
    const clk = document.getElementById('clock');
    if (clk) clk.innerText = new Date().toLocaleTimeString();
}, 1000);

// ─── Chat Engine ─────────────────────────────────────
let chatHistory = [];

async function sendQuery() {
    const input = document.getElementById('user-input');
    const history = document.getElementById('chat-history');
    if (!input.value.trim()) return;

    const userText = input.value.trim();
    input.value = "";

    // User Bubble
    history.innerHTML += `
        <div class="flex items-start justify-end gap-3 md:gap-4 max-w-4xl ml-auto mb-6 animate-[slideUp_0.3s_ease-out_forwards]">
            <div class="bg-primary-container/30 rounded-lg rounded-tr-none p-5 md:p-6" style="box-shadow: 0 4px 16px rgba(3,14,32,0.3);">
                <p class="leading-relaxed text-primary-fixed text-base font-body">${escapeHtml(userText)}</p>
            </div>
            <div class="w-10 h-10 rounded-md glass-panel flex-shrink-0 flex items-center justify-center bg-surface-container-high overflow-hidden">
                <span class="material-symbols-outlined text-primary text-xl">person</span>
            </div>
        </div>
    `;

    // Thinking indicator
    const thinkingId = 'thinking-' + Date.now();
    history.innerHTML += `
        <div id="${thinkingId}" class="flex items-start gap-3 md:gap-4 max-w-4xl mb-6">
            <div class="w-10 h-10 rounded-md flex-shrink-0 overflow-hidden bg-surface-container-high" style="box-shadow: 0 0 12px rgba(255,185,85,0.15);">
                <img src="${selectedLecturerImg}" class="w-full h-full object-cover">
            </div>
            <div class="flex items-center gap-2 px-5 py-3 glass-panel rounded-md">
                <div class="flex gap-1">
                    <div class="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style="animation-delay: -0.15s;"></div>
                    <div class="w-2 h-2 bg-primary/30 rounded-full animate-bounce" style="animation-delay: -0.3s;"></div>
                </div>
                <span class="text-xs font-label font-semibold uppercase tracking-[0.15em] text-on-surface-variant ml-2">${selectedLecturer} is thinking...</span>
            </div>
        </div>
    `;
    history.scrollTop = history.scrollHeight;

    try {
        const response = await fetch(`${API}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ character: selectedLecturer, message: userText, history: chatHistory })
        });

        if (response.status === 401) {
            const thinkingEl = document.getElementById(thinkingId);
            if (thinkingEl) thinkingEl.remove();
            showAuthError('Session expired. Please login again.');
            logout();
            return;
        }

        const data = await response.json();
        const botText = data.response;

        chatHistory.push({ role: "user", text: userText });
        chatHistory.push({ role: "model", text: botText });
        persistLocalSession();
        await saveConversationToServer();

        // Remove thinking indicator
        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) thinkingEl.remove();

        // AI Bubble
        const responseId = 'response-' + Date.now();
        history.innerHTML += `
            <div id="${responseId}" class="flex items-start gap-3 md:gap-4 max-w-4xl mb-6 animate-[slideUp_0.3s_ease-out_forwards]">
                <div class="w-10 h-10 rounded-md flex-shrink-0 overflow-hidden bg-surface-container-high" style="box-shadow: 0 0 12px rgba(255,185,85,0.15);">
                    <img src="${selectedLecturerImg}" class="w-full h-full object-cover">
                </div>
                <div class="bg-surface-container-low rounded-lg rounded-tl-none p-5 md:p-6 relative overflow-hidden flex-1" style="box-shadow: 0 8px 32px rgba(3,14,32,0.4);">
                    <div class="leading-relaxed text-on-surface text-base font-body">${renderReadableMarkdown(botText)}</div>
                </div>
            </div>
        `;
        scrollToMessageStart(document.getElementById(responseId));

        speakText(botText);

        // Avatar ring glow
        const ring = document.getElementById('avatar-ring');
        if (ring) {
            ring.style.boxShadow = '0 0 30px rgba(255,185,85,0.4)';
            setTimeout(() => {
                ring.style.boxShadow = '0 0 20px rgba(255,185,85,0.15)';
            }, 2500);
        }

    } catch (error) {
        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) thinkingEl.remove();

        history.innerHTML += `
            <div class="flex justify-center mt-2 mb-6">
                <span class="px-5 py-2 rounded-md bg-error-container/20 text-[10px] font-label font-semibold uppercase tracking-[0.15em] text-error text-center">Backend Offline or Error Detected</span>
            </div>
        `;
    }
}

// ─── Animations ──────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `
<style>
@keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
`);

syncVoiceButtons();
