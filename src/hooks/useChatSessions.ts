import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import * as sessionApi from '../api/mockSessionApi';
import { ChatApiError, sendMessage } from '../api/chatApi';
import type { ChatMessage, ChatSession, ChatSessionSummary } from '../types';
import { TEXT_GREETING_FALLBACK, TEXT_GREETING_PROMPT } from '../constants/chat';
import { getSessionIdFromUrl, setSessionIdInUrl } from '../utils/url';

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
    /** Appends a single message (e.g. from a voice call turn) to the given session and persists it. */
    appendMessage: (sessionId: string, message: ChatMessage) => Promise<void>;
}

/** Builds a brand-new, not-yet-saved session object. Nothing is written to the store here. */
function buildDraftSession(): ChatSession {
    const now = Date.now();
    return { id: uuid(), title: 'New chat', createdAt: now, updatedAt: now, messages: [] };
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
    // Mirrors `activeSession` synchronously so rapid back-to-back calls to appendMessage
    // (e.g. a voice turn's user message immediately followed by the assistant's reply)
    // don't race against React's render cycle and clobber each other.
    const activeSessionRef = useRef<ChatSession | null>(null);
    // Holds the id of a "New chat" that only exists in memory so far — created locally
    // when the user clicks "New chat", but never written to the store until they actually
    // send a message (text or voice). Null once that session is persisted, or if the
    // active session was never a draft to begin with (e.g. it was loaded from the list).
    // Kept as a ref rather than state since it needs to be read synchronously inside
    // callbacks (persistMessages) without waiting for a render.
    const draftSessionIdRef = useRef<string | null>(null);

    useEffect(() => {
        activeSessionRef.current = activeSession;
    }, [activeSession]);

    const refreshSessionList = useCallback(async () => {
        const list = await sessionApi.listSessions();
        setSessions(list);
    }, []);

    /**
     * Saves `messages` for `session`. If `session` is still an unsaved draft (see
     * `draftSessionIdRef` above), this is the moment it gets written to the store for
     * the first time — i.e. persistence is triggered by the user's first real
     * interaction (a sent message), not by clicking "New chat".
     */
    const persistMessages = useCallback(async (session: ChatSession, messages: ChatMessage[]) => {
        let updated: ChatSession | null;
        if (draftSessionIdRef.current === session.id) {
            const firstUserMessage = messages.find((m) => m.role === 'user');
            updated = await sessionApi.persistDraftSession({
                ...session,
                messages,
                updatedAt: Date.now(),
                title: firstUserMessage ? firstUserMessage.content.slice(0, 40) : session.title,
            });
            draftSessionIdRef.current = null;
        } else {
            updated = await sessionApi.updateSessionMessages(session.id, messages);
        }
        if (updated) {
            setActiveSession(updated);
        }
        await refreshSessionList();
        // refreshSessionList intentionally omitted from deps to avoid re-creating this callback every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Makes the assistant speak first in a brand-new chat instead of leaving it empty until
     * the user types something — a session that just sits blank isn't a great first impression.
     * Streams in the same word-by-word way as a normal reply. If the request fails (offline,
     * rate-limited, missing key), falls back to a static line rather than leaving the new chat
     * looking broken or blocking the user from just starting to type.
     */
    const sendGreeting = useCallback(
        async (session: ChatSession) => {
            const assistantId = uuid();
            const assistantCreatedAt = Date.now();
            setActiveSession((prev) =>
                prev && prev.id === session.id
                    ? {
                        ...prev,
                        messages: [{ id: assistantId, role: 'assistant', content: '', createdAt: assistantCreatedAt, status: 'sending' }],
                    }
                    : prev,
            );
            setIsSending(true);

            const kickoffMessage: ChatMessage = {
                id: 'kickoff',
                role: 'user',
                content: TEXT_GREETING_PROMPT,
                createdAt: Date.now(),
            };

            try {
                const replyText = await sendMessage({
                    sessionId: session.id,
                    history: [kickoffMessage],
                    text: TEXT_GREETING_PROMPT,
                    mode: 'text',
                    onDelta: (_delta, fullTextSoFar) => {
                        setActiveSession((prev) => {
                            if (!prev || prev.id !== session.id) return prev;
                            return {
                                ...prev,
                                messages: prev.messages.map((m) => (m.id === assistantId ? { ...m, content: fullTextSoFar } : m)),
                            };
                        });
                    },
                });

                const finalMessages: ChatMessage[] = [
                    { id: assistantId, role: 'assistant', content: replyText, createdAt: assistantCreatedAt, status: 'sent' },
                ];
                setActiveSession((prev) => (prev && prev.id === session.id ? { ...prev, messages: finalMessages } : prev));
                // Deliberately not persisted here — the greeting is the assistant talking to
                // an empty room. The session is only saved once the user says something back.
            } catch {
                const fallbackMessages: ChatMessage[] = [
                    { id: assistantId, role: 'assistant', content: TEXT_GREETING_FALLBACK, createdAt: assistantCreatedAt, status: 'sent' },
                ];
                setActiveSession((prev) => (prev && prev.id === session.id ? { ...prev, messages: fallbackMessages } : prev));
            } finally {
                setIsSending(false);
            }
        },
        [],
    );

    const createNewSession = useCallback(async () => {
        const draft = buildDraftSession();
        draftSessionIdRef.current = draft.id;
        setActiveSession(draft);
        setSessionIdInUrl(draft.id);
        setSendError(null);
        void sendGreeting(draft);
    }, [sendGreeting]);

    // Bootstrap: restore the session named in the URL (if any and it still exists), otherwise
    // fall back to the most recent session, creating (and greeting from) a first one if none exist.
    // A freshly-created first session is a draft too, same as clicking "New chat" — it isn't
    // written to the store until the user actually says something.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoadingSessions(true);
            const list = await sessionApi.listSessions();
            if (cancelled) return;

            const urlSessionId = getSessionIdFromUrl();
            const fromUrl = urlSessionId ? await sessionApi.getSession(urlSessionId) : null;
            if (cancelled) return;

            if (fromUrl) {
                setSessions(list);
                setActiveSession(fromUrl);
                setSessionIdInUrl(fromUrl.id, { replace: true });
            } else if (list.length === 0) {
                const draft = buildDraftSession();
                draftSessionIdRef.current = draft.id;
                setSessions([]);
                setActiveSession(draft);
                setSessionIdInUrl(draft.id, { replace: true });
                void sendGreeting(draft);
            } else {
                // Either there was no `session` param, or it pointed at a session that no
                // longer exists (deleted, cleared storage, stale bookmark) — fall back to
                // the most recent one and correct the URL to match.
                setSessions(list);
                const first = await sessionApi.getSession(list[0].id);
                if (!cancelled) {
                    setActiveSession(first);
                    if (first) setSessionIdInUrl(first.id, { replace: true });
                }
            }
            if (!cancelled) setIsLoadingSessions(false);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the active session in sync with browser back/forward navigation between
    // `?session=` URLs (e.g. after visiting a couple of different chats).
    useEffect(() => {
        const handlePopState = async () => {
            const id = getSessionIdFromUrl();
            if (!id) return;
            const session = await sessionApi.getSession(id);
            if (session) {
                draftSessionIdRef.current = null;
                setSendError(null);
                setActiveSession(session);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const selectSession = useCallback(async (id: string) => {
        setSendError(null);
        const session = await sessionApi.getSession(id);
        if (session) {
            // Navigating to a real, saved session — any in-progress "New chat" the user
            // didn't type anything into is abandoned here. Since it was never written to
            // the store, there's nothing to clean up; it simply ceases to exist.
            draftSessionIdRef.current = null;
            setActiveSession(session);
            setSessionIdInUrl(session.id);
        }
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
                    if (next) setSessionIdInUrl(next.id, { replace: true });
                } else {
                    await createNewSession();
                }
            }
        },
        [activeSession, refreshSessionList, createNewSession],
    );

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

            // A placeholder assistant message, filled in as chunks stream in below —
            // this is what makes the reply appear word-by-word instead of all at once.
            const assistantId = uuid();
            const assistantCreatedAt = Date.now();
            const withPlaceholder: ChatMessage[] = [
                ...withUserMessage,
                { id: assistantId, role: 'assistant', content: '', createdAt: assistantCreatedAt, status: 'sending' },
            ];
            setActiveSession({ ...activeSession, messages: withPlaceholder });
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
                    mode: 'text',
                    onDelta: (_delta, fullTextSoFar) => {
                        setActiveSession((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                messages: prev.messages.map((m) => (m.id === assistantId ? { ...m, content: fullTextSoFar } : m)),
                            };
                        });
                    },
                });

                const finalMessages: ChatMessage[] = [
                    ...withUserMessage,
                    { id: assistantId, role: 'assistant', content: replyText, createdAt: assistantCreatedAt, status: 'sent' },
                ];
                setActiveSession((prev) => (prev ? { ...prev, messages: finalMessages } : prev));
                await persistMessages(activeSession, finalMessages);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                const message =
                    err instanceof ChatApiError ? err.message : 'Something went wrong sending your message.';
                setSendError(message);
                lastFailedTextRef.current = text;
                // Keep the user's message in the thread but flag it as failed, and drop the empty/partial
                // placeholder bubble — `withUserMessage` never included it, so this naturally removes it.
                const messagesWithFailure = withUserMessage.map((m) =>
                    m.id === userMessage.id ? { ...m, status: 'error' as const } : m,
                );
                setActiveSession((prev) => (prev ? { ...prev, messages: messagesWithFailure } : prev));
                await persistMessages(activeSession, messagesWithFailure);
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

    const appendMessage = useCallback(
        async (sessionId: string, message: ChatMessage) => {
            const current = activeSessionRef.current;
            if (!current || current.id !== sessionId) return;
            const updatedMessages = [...current.messages, message];
            const updatedSession = { ...current, messages: updatedMessages };
            setActiveSession(updatedSession);
            activeSessionRef.current = updatedSession;
            await persistMessages(current, updatedMessages);
        },
        [persistMessages],
    );

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
        appendMessage,
    };
}