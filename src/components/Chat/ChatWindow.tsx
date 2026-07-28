import { useEffect, useRef } from 'react';
import type { ChatSession } from '../../types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';
import { ErrorBanner } from '../common/ErrorBanner';

interface ChatWindowProps {
    session: ChatSession | null;
    isSending: boolean;
    sendError: string | null;
    onSend: (text: string) => void;
    onRetry: () => void;
    onDismissError: () => void;
}

function EmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-500 dark:text-slate-500">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-surface-muted">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Start the conversation</p>
            <p className="max-w-xs text-sm">Ask a question or say hello — your assistant is ready when you are.</p>
        </div>
    );
}

export function ChatWindow({ session, isSending, sendError, onSend, onRetry, onDismissError }: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [session?.messages.length, isSending]);

    const messages = session?.messages ?? [];

    return (
        <div className="flex h-full min-h-0 flex-col bg-white dark:bg-surface">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                        {messages.map((message) => (
                            <MessageBubble key={message.id} message={message} />
                        ))}
                        {isSending && <TypingIndicator />}
                    </div>
                )}
            </div>

            {sendError && (
                <div className="mx-auto w-full max-w-3xl px-3 pb-2 sm:px-6">
                    <ErrorBanner message={sendError} onRetry={onRetry} onDismiss={onDismissError} />
                </div>
            )}

            <div className="mx-auto w-full max-w-3xl">
                <ChatInput onSend={onSend} disabled={isSending || !session} />
            </div>
        </div>
    );
}