import type { ChatSessionSummary } from '../../types';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';

interface SidebarProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function Sidebar({ sessions, activeSessionId, isLoading, onSelect, onCreate, onDelete, onClose }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-surface-raised">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <Button variant="secondary" className="flex-1 justify-start" onClick={onCreate}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        >
          New chat
        </Button>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-slate-400 hover:bg-surface-muted hover:text-slate-200 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Spinner size={18} />
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-4 text-sm text-slate-500">No conversations yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <li key={session.id} className="group relative">
                  <button
                    onClick={() => onSelect(session.id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm font-medium ${isActive ? 'text-slate-100' : 'text-slate-300'}`}>
                        {session.title || 'New chat'}
                      </p>
                      <span className="shrink-0 text-xs text-slate-500">{formatDate(session.updatedAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{session.lastMessagePreview}</p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                    aria-label={`Delete ${session.title}`}
                    className="absolute right-2 top-2 rounded-md p-1 text-slate-500 opacity-0 hover:bg-surface hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
