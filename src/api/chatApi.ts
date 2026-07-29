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
  /** Called with each new chunk of text as it streams in, plus the full text accumulated so far. */
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

  // Validation errors (bad body, missing API key) come back as plain JSON with a real
  // error status — those happen before the server commits to a stream.
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: undefined }));
    throw new ChatApiError(
        body.error || `Request failed with status ${response.status}`,
        response.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
    );
  }

  if (!response.body) {
    throw new ChatApiError('Received an empty response from the server.', 'BAD_RESPONSE');
  }

  // From here on, the server is streaming Server-Sent Events — parse the
  // `data: {...}\n\n` frames as they arrive and surface each text delta.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let streamError: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? ''; // keep any incomplete trailing frame for the next chunk

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) continue;

        let payload: { delta?: string; done?: boolean; error?: string };
        try {
          payload = JSON.parse(line.slice(5).trim());
        } catch {
          continue; // ignore malformed frames rather than failing the whole stream
        }

        if (payload.error) {
          streamError = payload.error;
        } else if (payload.delta) {
          fullText += payload.delta;
          onDelta?.(payload.delta, fullText);
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ChatApiError('Lost connection to the chat server mid-response.', 'NETWORK_ERROR');
  }

  if (streamError) {
    throw new ChatApiError(streamError, /rate limit/i.test(streamError) ? 'RATE_LIMITED' : 'SERVER_ERROR');
  }
  if (!fullText) {
    throw new ChatApiError('Received an empty response from the server.', 'BAD_RESPONSE');
  }
  return fullText;
}