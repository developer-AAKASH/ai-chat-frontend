import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aria-theme';

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * Manages light/dark theme state. The actual color values live in Tailwind
 * classes (`dark:` variants) throughout the components — this hook only
 * owns which mode is active, persists the user's choice, and applies the
 * `dark` class to <html> that those variants key off of.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        applyTheme(theme);
        window.localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    // Follow system preference changes, but only if the user hasn't made an explicit choice.
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: light)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (!window.localStorage.getItem(STORAGE_KEY)) {
                setTheme(e.matches ? 'light' : 'dark');
            }
        };
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    return { theme, toggleTheme };
}