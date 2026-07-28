import { v4 as uuid } from 'uuid';
import type { ChatMessage, ChatSession, ChatSessionSummary } from '../types';

/**
 * Mock session persistence layer.
 *
 * Every function here is async and returns plain data, matching the shape a
 * real REST/GraphQL backend would have (e.g. GET /sessions, POST /sessions,
 * PATCH /sessions/:id). The in-memory Map is the only thing that would need
 * to change to point this at a real API — swap the bodies for `fetch` calls
 * and every hook/component that consumes this module keeps working as-is.
 */

const store = new Map<string, ChatSession>();

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
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  await delay(80);
  store.delete(id);
}
