export function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Assistant is typing">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-blink rounded-full bg-slate-400"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
