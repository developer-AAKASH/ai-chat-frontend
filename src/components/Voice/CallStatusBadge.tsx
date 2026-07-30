import type { CallStatus } from '../../types';

const STATUS_CONFIG: Record<CallStatus, { label: string; dot: string; text: string }> = {
    idle: { label: 'Ready to call', dot: 'bg-slate-400 dark:bg-slate-500', text: 'text-slate-500 dark:text-slate-400' },
    connecting: { label: 'Connecting…', dot: 'bg-amber-500 dark:bg-amber-400', text: 'text-amber-600 dark:text-amber-300' },
    connected: { label: 'Connected', dot: 'bg-emerald-500 dark:bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-300' },
    listening: { label: 'Listening…', dot: 'bg-brand-500 dark:bg-brand-400', text: 'text-brand-800 dark:text-brand-300' },
    thinking: { label: 'Thinking…', dot: 'bg-sky-500 dark:bg-sky-400', text: 'text-sky-600 dark:text-sky-300' },
    speaking: { label: 'Speaking…', dot: 'bg-violet-500 dark:bg-violet-400', text: 'text-violet-600 dark:text-violet-300' },
    muted: { label: 'Muted', dot: 'bg-slate-400 dark:bg-slate-500', text: 'text-slate-500 dark:text-slate-400' },
    disconnected: { label: 'Call ended', dot: 'bg-slate-400 dark:bg-slate-500', text: 'text-slate-500 dark:text-slate-400' },
    error: { label: 'Call error', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-300' },
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
    const config = STATUS_CONFIG[status];
    const isPulsing = status === 'listening' || status === 'speaking' || status === 'connecting' || status === 'thinking';

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium dark:bg-surface-muted ${config.text}`}
        >
      <span className="relative flex h-2 w-2">
        {isPulsing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-60`} />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
      </span>
            {config.label}
        </div>
    );
}