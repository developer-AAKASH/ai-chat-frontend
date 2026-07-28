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
                ? 'rounded-br-sm bg-red-500/15 text-red-100 ring-1 ring-red-500/40'
                : 'rounded-br-sm bg-brand-500 text-white'
              : 'rounded-bl-sm bg-surface-muted text-slate-100'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <span>{formatTime(message.createdAt)}</span>
          {isError && <span className="text-red-400">· Failed to send</span>}
        </div>
      </div>
    </div>
  );
}
