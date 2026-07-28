# Aria — AI Chat & Voice Assistant

A responsive React + TypeScript app for chatting with an AI assistant over text or voice.

## Getting started

### 1. Get a free Gemini API key
Go to **https://aistudio.google.com/apikey**, sign in, and click "Create API key." No credit card
required. This gives you a free daily quota on `gemini-2.5-flash` (a genuine frontier-class model),
which is plenty for testing this app.

### 2. Configure the backend
```bash
cp server/.env.example server/.env
```
Open `server/.env` and paste your key:
```
GEMINI_API_KEY=your_key_here
```

### 3. Install and run
```bash
npm install                 # installs the frontend
npm install --prefix server # installs the backend (its own package.json in server/)
npm run dev:all             # runs both together
```
Open the printed local URL (usually http://localhost:5173). Both text chat and the voice call now
call the real Gemini model. Voice calling additionally requires a Chromium-based browser
(Chrome/Edge) with microphone permission.

Prefer running them separately (two terminals)?
```bash
cd server && npm run dev   # backend on http://localhost:8787, auto-restarts on change
npm run dev                 # (from project root) frontend on http://localhost:5173
```

```bash
npm run build     # production build (frontend only)
npm run preview   # preview the production build
```

### Why a backend at all?
The browser can't safely hold an API key — anyone can open devtools and steal it. `server/index.js`
is a small Express proxy: the frontend calls `/api/chat` (same-origin, proxied by Vite in dev), the
server attaches your key and calls Gemini, and only the reply text comes back to the browser.

### Swapping to a different provider
Groq is another strong free, no-card, OpenAI-compatible option — useful if you want lower latency
for the voice flow. To switch: replace the `@google/generative-ai` call in `server/index.js` with
an OpenAI-SDK call pointed at `https://api.groq.com/openai/v1`, using a Groq API key
(from https://console.groq.com/keys) and a model like `llama-3.3-70b-versatile`. The `/api/chat`
request/response shape the frontend expects (`{ messages }` in, `{ reply }` out) doesn't need to
change either way.

### Going back to the mock (offline demo, no API key)
The original in-memory mock is still in `src/api/mockChatApi.ts`. To use it instead of the real
backend, swap the import in `src/hooks/useChatSessions.ts` and `src/hooks/useVoiceCall.ts` back
from `../api/chatApi` to `../api/mockChatApi` — the function signature is identical, so nothing
else changes.

## Project structure

```
server/
  package.json       backend's own dependencies (express, cors, dotenv, @google/generative-ai)
  index.js           Express proxy — holds the Gemini API key, exposes POST /api/chat
  .env.example        copy to .env and add your key (never commit .env)

src/
  types/            Shared domain types (ChatMessage, ChatSession, CallStatus, etc.)
  api/
    chatApi.ts           real chat client — calls the Express backend above
    mockChatApi.ts       original simulated replies (kept for offline/no-key demo use)
    mockSessionApi.ts    simulated session persistence (list/create/update/delete)
    voiceEngine.ts       wraps the browser's real SpeechRecognition + SpeechSynthesis
  hooks/
    useChatSessions.ts   owns session list, active session, sending, retry, errors
    useVoiceCall.ts       owns the call state machine and live transcript
  components/
    Chat/             MessageBubble, TypingIndicator, ChatInput, ChatWindow
    Voice/             CallStatusBadge, TranscriptPanel, VoiceCallPanel
    Sessions/          Sidebar (session list, new chat, delete)
    common/            Button, Spinner, ErrorBanner — reused across chat & voice
  App.tsx             Layout, tab switching, responsive sidebar
```

## Design decisions

- **Mock API shape mirrors a real backend.** Every function in `src/api` is `async` and returns
  plain data (no framework-specific state), so pointing the app at a real backend later is a
  matter of replacing function bodies with `fetch` calls — no changes needed in hooks or
  components.
- **Voice uses real browser APIs.** Per the brief, `voiceEngine.ts` wraps the actual
  `SpeechRecognition` (speech-to-text) and `SpeechSynthesis` (text-to-speech) Web APIs, so the mic
  and audio output are real. Only the assistant's *reply generation* is mocked (via the same
  mock chat backend used for text), since there's no live AI voice backend to call.
- **State management stays in hooks, not global stores.** `useChatSessions` and `useVoiceCall`
  encapsulate all related state and side effects, keeping components close to presentational.
  This scales cleanly to a real backend or a state library (Zustand/Redux) later without a
  rewrite — the hook's public interface wouldn't need to change.
- **Error handling is visible and recoverable.** Failed messages stay in the thread (flagged, not
  dropped) with a retry action; voice errors surface as a banner without ending the call.
- **Responsive by default.** Sidebar collapses to a mobile drawer under `md`, chat bubbles cap
  width per breakpoint, and the layout uses `h-dvh` to handle mobile browser chrome correctly.

## Known limitations (mock scope)

- Session data is in-memory only (per the chosen scope: "mock now, design for a real backend
  later") — refreshing the page resets sessions. `mockSessionApi.ts` is structured so swapping in
  `localStorage` or a real API is a small, isolated change.
- The assistant's replies are canned/randomized text, not a real LLM.
- Voice transcription quality depends on the browser's built-in speech engine.
