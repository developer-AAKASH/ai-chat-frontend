import type { CallStatus } from '../../types';

const STATUS_CONFIG: Record<CallStatus, { label: string; dot: string; text: string }> = {
  idle: { label: 'Ready to call', dot: 'bg-slate-500', text: 'text-slate-400' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-400', text: 'text-amber-300' },
  connected: { label: 'Connected', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  listening: { label: 'Listening…', dot: 'bg-brand-400', text: 'text-brand-300' },
  speaking: { label: 'Speaking…', dot: 'bg-violet-400', text: 'text-violet-300' },
  disconnected: { label: 'Call ended', dot: 'bg-slate-500', text: 'text-slate-400' },
  error: { label: 'Call error', dot: 'bg-red-500', text: 'text-red-300' },
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const config = STATUS_CONFIG[status];
  const isPulsing = status === 'listening' || status === 'speaking' || status === 'connecting';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-sm font-medium ${config.text}`}>
      <span className="relative flex h-2 w-2">
        {isPulsing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-60`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
      </span>
      {config.label}
    </div>
  );
}
