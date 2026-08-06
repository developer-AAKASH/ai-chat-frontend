/**
 * Small helpers for syncing the active chat session id with the URL's
 * `session` query param.
 *
 * This is what lets a session be bookmarked, shared, or survive a page
 * refresh, and it's what makes the browser's back/forward buttons move
 * between sessions instead of doing nothing.
 */

const SESSION_PARAM = 'session';

/** Reads the current `?session=` value from the URL, or null if absent. */
export function getSessionIdFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get(SESSION_PARAM);
}

interface SetSessionIdOptions {
    /**
     * `true` writes the URL without adding a new browser-history entry
     * (used for the initial bootstrap redirect, so the very first page
     * load doesn't leave a stray extra "back" step). Defaults to `false`,
     * which pushes a new entry — used for user-driven navigation like
     * picking a session from the sidebar or starting a new chat, so
     * back/forward works the way people expect.
     */
    replace?: boolean;
}

/** Writes (or clears, if `id` is null) the `?session=` query param. */
export function setSessionIdInUrl(id: string | null, { replace = false }: SetSessionIdOptions = {}): void {
    const url = new URL(window.location.href);
    if (id) {
        url.searchParams.set(SESSION_PARAM, id);
    } else {
        url.searchParams.delete(SESSION_PARAM);
    }

    // Nothing to do if the URL wouldn't actually change — avoids polluting
    // history with no-op entries.
    if (url.href === window.location.href) return;

    if (replace) {
        window.history.replaceState(null, '', url);
    } else {
        window.history.pushState(null, '', url);
    }
}