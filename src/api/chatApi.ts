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
  /** For RATE_LIMITED errors, how long (in seconds) to wait before it's worth retrying, if known. */
  retryAfterSeconds?: number;
  constructor(message: string, code = 'CHAT_API_ERROR', retryAfterSeconds?: number) {
    super(message);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
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
  /**
   * Called once the full reply has arrived (kept for compatibility with callers that were
   * built around word-by-word streaming — there's just a single call here now, with the
   * complete text both times, instead of one call per chunk).
   */
  onDelta?: (delta: string, fullTextSoFar: string) => void;
}

export async function sendMessage({ history, signal, mode = 'text', onDelta }: SendMessageParams): Promise<string> {
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

  const body = await response.json().catch(() => ({ error: undefined, retryAfterSeconds: undefined, reply: undefined }));

  if (!response.ok) {
    throw new ChatApiError(
        body.error || `Request failed with status ${response.status}`,
        response.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
        body.retryAfterSeconds,
    );
  }

  const reply: string | undefined = body.reply;
  if (!reply) {
    throw new ChatApiError('Received an empty response from the server.', 'BAD_RESPONSE');
  }

  // Callers were built around progressive updates — fire onDelta once with the full text so
  // they still render correctly, they just get it all at once instead of word-by-word.
  onDelta?.(reply, reply);

  return reply;
}