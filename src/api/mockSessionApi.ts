import { v4 as uuid } from 'uuid';
import type { ChatMessage, ChatSession, ChatSessionSummary } from '../types';
import { STORAGE_KEYS } from '../constants/storage';

/**
 * Mock session persistence layer.
 *
 * Every function here is async and returns plain data, matching the shape a
 * real REST/GraphQL backend would have (e.g. GET /sessions, POST /sessions,
 * PATCH /sessions/:id). The in-memory Map is the only thing that would need
 * to change to point this at a real API — swap the bodies for `fetch` calls
 * and every hook/component that consumes this module keeps working as-is.
 */

function loadStore(): Map<string, ChatSession> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as ChatSession[];
    return new Map(parsed.map((session) => [session.id, session]));
  } catch {
    // Corrupt or inaccessible storage (private browsing, quota, etc.) — fall back to an empty store
    // rather than crashing the app.
    return new Map();
  }
}

function saveStore(store: Map<string, ChatSession>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(Array.from(store.values())));
  } catch {
    // Ignore write failures (e.g. storage full or disabled) — the session still works in-memory
    // for the rest of this tab session, it just won't survive a refresh.
  }
}

const store = loadStore();

function delay(ms = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSummary(session: ChatSession): ChatSessionSummary {
  const last = session.messages[session.messages.length - 1];
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessagePreview: last ? last.content.slice(0, 80) : 'No messages yet',
  };
}

export async function listSessions(): Promise<ChatSessionSummary[]> {
  await delay();
  return Array.from(store.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(toSummary);
}

export async function getSession(id: string): Promise<ChatSession | null> {
  await delay(80);
  return store.get(id) ?? null;
}

export async function createSession(): Promise<ChatSession> {
  await delay(100);
  const now = Date.now();
  const session: ChatSession = {
    id: uuid(),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  store.set(session.id, session);
  saveStore(store);
  return session;
}

/**
 * Writes a session to the store for the first time.
 *
 * Used to promote an in-memory-only "draft" session (created by `createNewSession`
 * in the hook, but deliberately never sent to the backend) into a real, persisted
 * one — which only happens once the user actually sends a message. Until then the
 * draft exists purely in React state, so an abandoned "New chat" never shows up
 * in the sidebar or survives a refresh.
 */
export async function persistDraftSession(session: ChatSession): Promise<ChatSession> {
  await delay(60);
  store.set(session.id, session);
  saveStore(store);
  return session;
}

export async function updateSessionMessages(
    id: string,
    messages: ChatMessage[],
): Promise<ChatSession | null> {
  await delay(60);
  const session = store.get(id);
  if (!session) return null;
  const firstUserMessage = messages.find((m) => m.role === 'user');
  const updated: ChatSession = {
    ...session,
    messages,
    updatedAt: Date.now(),
    title:
        session.title === 'New chat' && firstUserMessage
            ? firstUserMessage.content.slice(0, 40)
            : session.title,
  };
  store.set(id, updated);
  saveStore(store);
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await delay(80);
  store.delete(id);
  saveStore(store);
}