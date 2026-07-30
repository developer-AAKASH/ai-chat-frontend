<img src="./public/logo-lockup.svg" alt="FRIDAY — AI Chat & Voice Assistant" width="420" />

# FRIDAY

Meet **FRIDAY** — a warm, sharp, and quietly witty AI assistant you can talk to by typing or by
voice. FRIDAY isn't just a model dumping text into a chat window: it's built to feel like a
capable personal assistant, anticipating what's actually useful rather than answering literally,
whether you're reading its replies or having it talk back to you on a live call.

This repo is a full-stack React + TypeScript + Express app: the frontend renders the chat/voice
experience, and a small Express backend holds the Gemini API key and calls the model on FRIDAY's
behalf, so the key never touches the browser.

## Features

- 💬 **Text chat** with streaming, word-by-word replies
- 🎙️ **Real voice calls** — actual browser microphone input (SpeechRecognition) and spoken replies
  (SpeechSynthesis), with tap-to-interrupt so you can cut in mid-reply like a real call
- 🧠 **One shared brain** — text and voice both talk to the same Gemini backend, so a voice call
  and a text thread are just two views onto one conversation history
- 🗂️ **Auto-titled chats** — FRIDAY turns your first message into a short, meaningful sidebar
  title instead of just truncating raw text
- ♻️ **Resilient by design** — failed messages stay in the thread with a retry action, rate limits
  surface as a clear message instead of a silent failure, and ending or leaving a call fully tears
  down the mic/audio instead of leaving a ghost call running
- 🌗 **Light/dark theme**, persisted across visits
- 📱 **Responsive** — the sidebar collapses into a smoothly animated mobile drawer under `md`

## Getting started

### 1. Get a free Gemini API key
Go to **https://aistudio.google.com/apikey**, sign in, and click "Create API key." No credit card
required.

### 2. Configure the backend
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` and paste your key:
```
GEMINI_API_KEY=your_key_here
```

### 3. Install and run

**Two terminals (recommended):**
```bash
# Terminal 1 — backend, http://localhost:8787, auto-restarts on change
cd backend
npm install
npm run dev

# Terminal 2 — frontend, http://localhost:5173
cd frontend
npm install
npm run dev
```

**One terminal, if you'd rather:**
```bash
cd frontend
npm install
npm install --prefix ../backend
npm run dev:all
```

Either way, open the printed local URL (usually http://localhost:5173). Both text chat and voice
calls talk to the real Gemini model. Voice calling additionally needs a Chromium-based browser
(Chrome/Edge) with microphone permission — the Web Speech API isn't implemented everywhere yet.

```bash
npm run build     # production build (frontend only)
npm run preview   # preview the production build
```

### Why a backend at all?
The browser can't safely hold an API key — anyone can open devtools and steal it. `backend/index.js`
is a small Express proxy: the frontend calls `/api/chat` and `/api/title` (proxied by Vite in dev),
the server attaches your key and calls Gemini, and only the result comes back to the browser.

### Swapping to a different model or provider
Set `GEMINI_MODEL` in `backend/.env` to use a different Gemini model (see `backend/constants/config.js`
for the current default). To switch providers entirely, Groq is a strong free, no-card,
OpenAI-compatible option — replace the `@google/genai` calls in `backend/index.js` with an
OpenAI-SDK call pointed at `https://api.groq.com/openai/v1` (key from
https://console.groq.com/keys, e.g. model `llama-3.3-70b-versatile`). The request/response shapes
the frontend expects (`{ messages }` → `{ reply }`, `{ message }` → `{ title }`) don't need to change.

## Project structure

```
backend/
  package.json        backend's own dependencies (express, cors, dotenv, @google/genai)
  index.js             Express proxy — holds the Gemini API key, exposes /api/chat and /api/title
  constants/
    config.js           server/model defaults, timing, error-matching patterns
    prompts.js           FRIDAY's system prompts (text, voice, and title-generation personas)
  .env.example          copy to .env and add your key (never commit .env)

frontend/
  public/
    logo-mark.svg        FRIDAY's icon mark (used as the favicon)
    logo-lockup.svg       icon + wordmark (used at the top of this README)
  src/
    types/               shared domain types (ChatMessage, ChatSession, CallStatus, etc.)
    constants/           branding, storage keys, greeting copy, timing/UI tuning — see below
    api/
      chatApi.ts           real chat client — calls the Express backend above
      titleApi.ts           asks the backend to generate a short chat title
      mockChatApi.ts        original simulated replies (unused, kept for reference)
      mockSessionApi.ts    session persistence (list/create/rename/delete), backed by localStorage
      voiceEngine.ts       wraps the browser's real SpeechRecognition + SpeechSynthesis
    hooks/
      useChatSessions.ts   owns session list, active session, sending, retry, auto-titling, errors
      useVoiceCall.ts       owns the call state machine, live transcript, and call teardown
      useTheme.ts           light/dark theme, persisted
    components/
      Chat/                MessageBubble, TypingIndicator, ChatInput, ChatWindow
      Voice/                CallStatusBadge, TranscriptPanel, VoiceCallPanel
      Sessions/            Sidebar (session list, new chat, delete)
      common/               Button, Spinner, ErrorBanner, ThemeToggle
    App.tsx               Layout, tab switching, responsive sidebar
```

`frontend/src/constants/` is worth calling out on its own — every piece of app config that used
to be a magic string or number scattered through the code now lives here in one place:

| File | Holds |
|---|---|
| `assistant.ts` | FRIDAY's display name — change it once to rebrand the whole app |
| `storage.ts` | localStorage keys |
| `chat.ts` / `voice.ts` | greeting prompts/fallbacks, speech tuning, call timing |
| `session.ts` | default session title, fallback-title length |
| `ui.ts` | small shared UI tuning (animation stagger, input max-height) |
| `api.ts` | backend endpoint paths |

## Design decisions

- **A real backend, real voice.** Text replies and voice replies both come from the same live
  Gemini backend (`backend/index.js`); voice itself uses the actual browser `SpeechRecognition`
  and `SpeechSynthesis` Web APIs, so the mic and audio output are real, not simulated.
- **State management stays in hooks, not global stores.** `useChatSessions` and `useVoiceCall`
  encapsulate all related state and side effects, keeping components close to presentational.
  This scales cleanly to a different backend or a state library later without a rewrite.
- **Error handling is visible and recoverable.** Failed messages stay in the thread (flagged, not
  dropped) with a retry action; voice errors surface as a banner without ending the call.
- **Calls clean up after themselves.** Ending a call — or just switching back to the Chat tab —
  fully tears down the mic, cancels any in-flight request, and stops any audio, so coming back to
  the Voice tab always starts from a clean, idle state.
- **Responsive by default.** The sidebar collapses to an animated mobile drawer under `md`, chat
  bubbles cap width per breakpoint, and the layout uses `h-dvh` to handle mobile browser chrome
  correctly.

## Known limitations

- Session storage is `localStorage`-backed, not a real database — it survives a refresh but is
  local to one browser and won't sync across devices. `mockSessionApi.ts` is structured so
  swapping in a real API is a small, isolated change.
- Renaming a session is supported at the data layer (`renameSession` / `PATCH`-style
  `updateSessionTitle`), but there's no rename control in the sidebar UI yet — titles currently
  update automatically (auto-generated, or the raw-text fallback) rather than by hand.
- Voice transcription quality depends on the browser's built-in speech engine, and the Web Speech
  API is currently Chromium-only in practice.