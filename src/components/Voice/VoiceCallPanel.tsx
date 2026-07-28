import { useVoiceCall } from '../../hooks/useVoiceCall';
import { CallStatusBadge } from './CallStatusBadge';
import { TranscriptPanel } from './TranscriptPanel';
import { Button } from '../common/Button';
import { ErrorBanner } from '../common/ErrorBanner';

const CALL_ACTIVE_STATUSES = new Set(['connecting', 'connected', 'listening', 'speaking']);

export function VoiceCallPanel() {
  const { status, transcript, errorMessage, isSupported, startCall, endCall } = useVoiceCall();
  const isCallActive = CALL_ACTIVE_STATUSES.has(status);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex flex-col items-center gap-4 border-b border-white/5 px-4 py-6 sm:py-8">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {(status === 'listening' || status === 'speaking') && (
            <span className="absolute inset-0 animate-pulseRing rounded-full bg-brand-500/40" />
          )}
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-colors ${
              status === 'speaking'
                ? 'bg-violet-500'
                : status === 'listening'
                  ? 'bg-brand-500'
                  : 'bg-surface-muted text-slate-400'
            }`}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M19 11a7 7 0 0 1-14 0M12 18v3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <CallStatusBadge status={status} />

        {!isCallActive ? (
          <Button size="lg" onClick={startCall} disabled={!isSupported}>
            Start call
          </Button>
        ) : (
          <Button size="lg" variant="danger" onClick={endCall}>
            End call
          </Button>
        )}

        {!isSupported && (
          <p className="max-w-sm text-center text-xs text-slate-500">
            This browser doesn't support the Web Speech API. Try the latest Chrome or Edge on desktop.
          </p>
        )}
      </div>

      {errorMessage && (
        <div className="px-4 pt-3 sm:px-6">
          <ErrorBanner message={errorMessage} />
        </div>
      )}

      <TranscriptPanel entries={transcript} />
    </div>
  );
}
