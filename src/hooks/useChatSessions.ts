import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import * as sessionApi from '../api/mockSessionApi';
import { ChatApiError, sendMessage } from '../api/chatApi';
import type { ChatMessage, ChatSession, ChatSessionSummary } from '../types';

interface UseChatSessionsResult {
  sessions: ChatSessionSummary[];
  activeSession: ChatSession | null;
  activeSessionId: string | null;
  isLoadingSessions: boolean;
  isSending: boolean;
  sendError: string | null;
  selectSession: (id: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  sendUserMessage: (text: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  dismissError: () => void;
}

/**
 * Owns everything related to chat sessions: the sidebar list, the currently
 * active conversation, and sending messages within it. Kept as a single hook
 * (rather than scattering this across components) so ChatWindow, Sidebar,
 * etc. can all be simple, mostly-presentational components.
 */
export function useChatSessions(): UseChatSessionsResult {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const lastFailedTextRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshSessionList = useCallback(async () => {
    const list = await sessionApi.listSessions();
    setSessions(list);
  }, []);

  const createNewSession = useCallback(async () => {
    const session = await sessionApi.createSession();
    await refreshSessionList();
    setActiveSession(session);
    setSendError(null);
  }, [refreshSessionList]);

  // Bootstrap: load session list, creating a first session if none exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingSessions(true);
      const list = await sessionApi.listSessions();
      if (cancelled) return;
      if (list.length === 0) {
        const session = await sessionApi.createSession();
        if (cancelled) return;
        setSessions(await sessionApi.listSessions());
        setActiveSession(session);
      } else {
        setSessions(list);
        const first = await sessionApi.getSession(list[0].id);
        if (!cancelled) setActiveSession(first);
      }
      if (!cancelled) setIsLoadingSessions(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setSendError(null);
    const session = await sessionApi.getSession(id);
    setActiveSession(session);
  }, []);

  const removeSession = useCallback(
    async (id: string) => {
      await sessionApi.deleteSession(id);
      await refreshSessionList();
      if (activeSession?.id === id) {
        const remaining = await sessionApi.listSessions();
        if (remaining.length > 0) {
          const next = await sessionApi.getSession(remaining[0].id);
          setActiveSession(next);
        } else {
          await createNewSession();
        }
      }
    },
    [activeSession, refreshSessionList, createNewSession],
  );

  const persistMessages = useCallback(async (sessionId: string, messages: ChatMessage[]) => {
    const updated = await sessionApi.updateSessionMessages(sessionId, messages);
    if (updated) {
      setActiveSession(updated);
    }
    await refreshSessionList();
    // refreshSessionList intentionally omitted from deps to avoid re-creating this callback every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSend = useCallback(
    async (text: string) => {
      if (!activeSession || !text.trim()) return;
      setSendError(null);
      lastFailedTextRef.current = null;

      const userMessage: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: text.trim(),
        createdAt: Date.now(),
        status: 'sent',
      };

      const withUserMessage = [...activeSession.messages, userMessage];
      setActiveSession({ ...activeSession, messages: withUserMessage });
      setIsSending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const replyText = await sendMessage({
          sessionId: activeSession.id,
          history: withUserMessage,
          text: userMessage.content,
          signal: controller.signal,
        });

        const assistantMessage: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: replyText,
          createdAt: Date.now(),
          status: 'sent',
        };

        const finalMessages = [...withUserMessage, assistantMessage];
        setActiveSession((prev) => (prev ? { ...prev, messages: finalMessages } : prev));
        await persistMessages(activeSession.id, finalMessages);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof ChatApiError ? err.message : 'Something went wrong sending your message.';
        setSendError(message);
        lastFailedTextRef.current = text;
        // Keep the user's message in the thread but flag it as failed, and persist so it's not lost on refresh.
        const messagesWithFailure = withUserMessage.map((m) =>
          m.id === userMessage.id ? { ...m, status: 'error' as const } : m,
        );
        setActiveSession((prev) => (prev ? { ...prev, messages: messagesWithFailure } : prev));
        await persistMessages(activeSession.id, messagesWithFailure);
      } finally {
        setIsSending(false);
      }
    },
    [activeSession, persistMessages],
  );

  const sendUserMessage = useCallback((text: string) => runSend(text), [runSend]);

  const retryLastMessage = useCallback(async () => {
    const text = lastFailedTextRef.current;
    if (!text || !activeSession) return;
    // Remove the failed message before retrying so we don't duplicate it.
    const withoutFailed = activeSession.messages.filter((m) => m.status !== 'error');
    setActiveSession({ ...activeSession, messages: withoutFailed });
    await runSend(text);
  }, [activeSession, runSend]);

  const dismissError = useCallback(() => setSendError(null), []);

  return {
    sessions,
    activeSession,
    activeSessionId: activeSession?.id ?? null,
    isLoadingSessions,
    isSending,
    sendError,
    selectSession,
    createNewSession,
    removeSession,
    sendUserMessage,
    retryLastMessage,
    dismissError,
  };
}
