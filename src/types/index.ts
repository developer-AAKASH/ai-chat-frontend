/**
 * Central domain types for the chat + voice assistant app.
 * Keeping these in one place makes it easy to swap the mock API layer
 * for a real backend later without touching component code.
 */

export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'sending' | 'sent' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  /** Where this message originated — lets the UI show a small indicator on voice-call messages. */
  channel?: 'text' | 'voice';
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

/** Lightweight summary used for the session list — avoids shipping full message arrays to the sidebar. */
export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
}

export type CallStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'listening'
    | 'speaking'
    | 'disconnected'
    | 'error';

export interface TranscriptEntry {
  id: string;
  role: MessageRole;
  text: string;
  isFinal: boolean;
  createdAt: number;
}

export interface ApiError {
  message: string;
  code?: string;
}