import { useVoiceCall } from '../../hooks/useVoiceCall';
import { CallStatusBadge } from './CallStatusBadge';
import { TranscriptPanel } from './TranscriptPanel';
import { Button } from '../common/Button';
import { ErrorBanner } from '../common/ErrorBanner';
import type { ChatMessage } from '../../types';
import { TYPING_DOT_DELAY_STEP_S } from '../../constants/ui';

const CALL_ACTIVE_STATUSES = new Set(['connecting', 'connected', 'listening', 'thinking', 'speaking', 'muted']);

interface VoiceCallPanelProps {
    sessionId: string | null;
    onMessage: (sessionId: string, message: ChatMessage) => void;
}

export function VoiceCallPanel({ sessionId, onMessage }: VoiceCallPanelProps) {
    const { status, transcript, errorMessage, isSupported, startCall, endCall, interrupt, isMuted, toggleMute } =
        useVoiceCall(sessionId, onMessage);
    const isCallActive = CALL_ACTIVE_STATUSES.has(status);
    const isInterruptible = status === 'thinking' || status === 'speaking';

    return (
        <div className="flex h-full min-h-0 flex-col bg-white dark:bg-surface">
            <div className="flex flex-col items-center gap-4 border-b border-slate-200 px-4 py-6 dark:border-white/5 sm:py-8">
                <div className="relative flex h-24 w-24 items-center justify-center">
                    {(status === 'listening' || status === 'speaking') && (
                        <span className="absolute inset-0 animate-pulseRing rounded-full bg-brand-500/40" />
                    )}
                    <button
                        type="button"
                        onClick={interrupt}
                        disabled={!isInterruptible}
                        aria-label={isInterruptible ? 'Interrupt the assistant' : undefined}
                        className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-colors ${
                            isInterruptible ? 'cursor-pointer' : 'cursor-default'
                        } ${
                            status === 'speaking'
                                ? 'bg-violet-500'
                                : status === 'thinking'
                                    ? 'bg-sky-500'
                                    : status === 'listening'
                                        ? 'bg-brand-700'
                                        : status === 'muted'
                                            ? 'bg-slate-400 dark:bg-slate-600'
                                            : 'bg-slate-100 text-slate-500 dark:bg-surface-muted dark:text-slate-400'
                        }`}
                    >
                        {status === 'thinking' ? (
                            <span className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-2 w-2 animate-blink rounded-full bg-white"
                        style={{ animationDelay: `${i * TYPING_DOT_DELAY_STEP_S}s` }}
                    />
                ))}
              </span>
                        ) : (
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
                        )}
                    </button>
                </div>

                <CallStatusBadge status={status} />

                {isInterruptible ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Tap to jump in</p>
                ) : status === 'muted' ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Mic is muted — tap Unmute to speak</p>
                ) : (
                    sessionId && <p className="text-xs text-slate-400 dark:text-slate-500">Saved to your chat history as you talk</p>
                )}

                {!isCallActive ? (
                    <Button size="lg" onClick={startCall} disabled={!isSupported}>
                        Start call
                    </Button>
                ) : (
                    <div className="flex items-center gap-3">
                        <Button
                            size="lg"
                            variant={isMuted ? 'primary' : 'secondary'}
                            onClick={toggleMute}
                            aria-pressed={isMuted}
                            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                            icon={
                                isMuted ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-5.94-.6M9 9v3a3 3 0 0 0 4.24 2.74"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M19 11a7 7 0 0 1-1.02 3.64M5 11a7 7 0 0 0 10.54 6.03M12 18v3M3 3l18 18"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                                )
                            }
                        >
                            {isMuted ? 'Unmute' : 'Mute'}
                        </Button>
                        <Button size="lg" variant="danger" onClick={endCall}>
                            End call
                        </Button>
                    </div>
                )}

                {!isSupported && (
                    <p className="max-w-sm text-center text-xs text-slate-500 dark:text-slate-500">
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