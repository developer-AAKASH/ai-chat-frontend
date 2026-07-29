import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
    message: ChatMessage;
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isError = message.status === 'error';

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isUser
                            ? isError
                                ? 'rounded-br-sm bg-red-50 text-red-700 ring-1 ring-red-300 dark:bg-red-500/15 dark:text-red-100 dark:ring-red-500/40'
                                : 'rounded-br-sm bg-brand-500 text-white'
                            : 'rounded-bl-sm bg-slate-100 text-slate-900 dark:bg-surface-muted dark:text-slate-100'
                    }`}
                >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
                <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-500">
                    {message.channel === 'voice' && (
                        <span className="inline-flex items-center gap-0.5" title="From a voice call">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                    d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                />
                <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
                    )}
                    <span>{formatTime(message.createdAt)}</span>
                    {isError && <span className="text-red-500 dark:text-red-400">· Failed to send</span>}
                </div>
            </div>
        </div>
    );
}