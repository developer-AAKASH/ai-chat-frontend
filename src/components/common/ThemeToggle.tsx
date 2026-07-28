import type { Theme } from '../../hooks/useTheme';

interface ThemeToggleProps {
    theme: Theme;
    onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
    const isDark = theme === 'dark';
    return (
        <button
            onClick={onToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-surface-muted dark:hover:text-slate-200"
        >
            {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                    <path
                        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                </svg>
            ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </button>
    );
}