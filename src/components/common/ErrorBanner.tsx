interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
      <div className="flex-1">
        <p>{message}</p>
        <div className="mt-1.5 flex gap-3">
          {onRetry && (
            <button onClick={onRetry} className="font-medium underline underline-offset-2 hover:text-red-100">
              Try again
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} className="text-red-300/80 hover:text-red-100">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
