import type { ChatMessage } from '../types';
import { WORD_REVEAL_DELAY_MS } from '../constants/chat';

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
  /** Called with each new chunk of text as it's revealed, plus the full text accumulated so far. */
  onDelta?: (delta: string, fullTextSoFar: string) => void;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
    );
  });
}

/**
 * Fakes the old word-by-word streaming effect on the frontend, now that the backend just
 * returns the full reply in one shot: reveals `fullText` to `onDelta` in word-sized chunks
 * with a short delay between them, instead of dumping it into the chat bubble all at once.
 * Purely cosmetic — doesn't touch the network layer at all.
 */
async function revealWordByWord(
    fullText: string,
    onDelta?: (delta: string, fullTextSoFar: string) => void,
    signal?: AbortSignal,
): Promise<void> {
  if (!onDelta) return;

  // Splits into "word + trailing whitespace" tokens so re-joining them reconstructs the
  // original text exactly (including newlines, double spaces, etc.).
  const tokens = fullText.match(/\S+\s*/g) ?? [fullText];

  let accumulated = '';
  for (const token of tokens) {
    accumulated += token;
    onDelta(token, accumulated);
    await delay(WORD_REVEAL_DELAY_MS, signal);
  }
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

  // The reply already arrived in full — this just plays it back to the caller word-by-word
  // for the typewriter effect. Aborting (e.g. the user sent a new message) stops it early.
  await revealWordByWord(reply, onDelta, signal);

  return reply;
}