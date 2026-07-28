import type { ChatMessage } from '../types';

/**
 * Mock chat backend.
 *
 * This module intentionally exposes the same shape a real backend call would:
 * an async function that takes conversation context and returns an assistant
 * message. Swapping this for `fetch('/api/chat', ...)` later requires no
 * changes to the hooks or components that consume it.
 */

const CANNED_REPLIES = [
  "That's a great question — here's how I'd think about it.",
  "Got it. Let me break that down for you.",
  "Sure thing! Here's a quick summary.",
  "Interesting — I hadn't considered it that way. Here's my take.",
  "Here's what I found relevant to that.",
];

function pickReply(userText: string): string {
  const trimmed = userText.trim().toLowerCase();
  if (trimmed.endsWith('?')) {
    return `${CANNED_REPLIES[0]} Regarding "${userText.trim()}" — this is a mock response standing in for a real AI backend.`;
  }
  const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
  return `${reply} (You said: "${userText.trim()}")`;
}

export interface SendMessageParams {
  sessionId: string;
  history: ChatMessage[];
  text: string;
  signal?: AbortSignal;
}

export class ChatApiError extends Error {
  code: string;
  constructor(message: string, code = 'CHAT_API_ERROR') {
    super(message);
    this.code = code;
    this.name = 'ChatApiError';
  }
}

/** Simulates network latency proportional to message length, plus a random jitter. */
function simulatedLatency(text: string): number {
  const base = 500;
  const perChar = 8;
  const jitter = Math.random() * 400;
  return Math.min(base + text.length * perChar + jitter, 2500);
}

export async function sendMessage({ text, signal }: SendMessageParams): Promise<string> {
  const delay = simulatedLatency(text);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

  // Simulate an occasional transient failure so the UI's error handling has something to do.
  if (Math.random() < 0.08) {
    throw new ChatApiError('The assistant is temporarily unavailable. Please try again.', 'RATE_LIMITED');
  }

  if (!text.trim()) {
    throw new ChatApiError('Cannot send an empty message.', 'EMPTY_MESSAGE');
  }

  return pickReply(text);
}
