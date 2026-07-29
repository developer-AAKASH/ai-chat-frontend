import { TYPING_DOT_DELAY_STEP_S } from '../../constants/ui';

export function TypingIndicator() {
    return (
        <div className="flex justify-start" aria-live="polite" aria-label="Assistant is typing">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 dark:bg-surface-muted">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-1.5 w-1.5 animate-blink rounded-full bg-slate-400 dark:bg-slate-400"
                        style={{ animationDelay: `${i * TYPING_DOT_DELAY_STEP_S}s` }}
                    />
                ))}
            </div>
        </div>
    );
}