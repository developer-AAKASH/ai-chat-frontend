import type { ChatMessage } from '../types';

/**
 * Real chat backend client.
 *
 * Talks to our own Express proxy (server/index.js), which in turn calls
 * Gemini — never call an LLM API directly from the browser, since that
 * would expose your API key to anyone who opens devtools.
 *
 * Same function signature as the old mock (`mockChatApi.ts`), so this is a
 * drop-in replacement: only the import path changes in the hooks.
 */

export class ChatApiError extends Error {
  code: string;
  constructor(message: string, code = 'CHAT_API_ERROR') {
    super(message);
    this.code = code;
    this.name = 'ChatApiError';
  }
}

export interface SendMessageParams {
  sessionId: string;
  history: ChatMessage[];
  text: string;
  signal?: AbortSignal;
  /** 'voice' triggers a shorter, more conversational spoken-style reply on the backend. Defaults to 'text'. */
  mode?: 'text' | 'voice';
}

export async function sendMessage({ history, signal, mode = 'text' }: SendMessageParams): Promise<string> {
  // `history` already ends with the newest user message (see useChatSessions / useVoiceCall),
  // so we just forward it as-is.
  const messages = history
      .filter((m) => m.status !== 'error')
      .map((m) => ({ role: m.role, content: m.content }));

  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, mode }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ChatApiError('Could not reach the chat server. Is `npm run server` running?', 'NETWORK_ERROR');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: undefined }));
    throw new ChatApiError(
        body.error || `Request failed with status ${response.status}`,
        response.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
    );
  }

  const data = await response.json();
  if (typeof data.reply !== 'string') {
    throw new ChatApiError('Received an unexpected response from the server.', 'BAD_RESPONSE');
  }
  return data.reply;
}