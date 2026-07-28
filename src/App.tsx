import { useState } from 'react';
import { useChatSessions } from './hooks/useChatSessions';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/Sessions/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { VoiceCallPanel } from './components/Voice/VoiceCallPanel';
import { ThemeToggle } from './components/common/ThemeToggle';

type Tab = 'chat' | 'voice';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
      <button
          onClick={onClick}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
      >
        {children}
      </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const {
    sessions,
    activeSession,
    activeSessionId,
    isLoadingSessions,
    isSending,
    sendError,
    selectSession,
    createNewSession,
    removeSession,
    sendUserMessage,
    retryLastMessage,
    dismissError,
  } = useChatSessions();

  return (
      <div className="flex h-dvh w-full overflow-hidden bg-white text-slate-900 dark:bg-surface dark:text-slate-100">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 dark:border-white/5 md:block">
          <Sidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              isLoading={isLoadingSessions}
              onSelect={(id) => {
                selectSession(id);
                setTab('chat');
              }}
              onCreate={() => {
                createNewSession();
                setTab('chat');
              }}
              onDelete={removeSession}
          />
        </aside>

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                  aria-label="Close sidebar overlay"
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setIsSidebarOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-xl">
                <Sidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    isLoading={isLoadingSessions}
                    onSelect={(id) => {
                      selectSession(id);
                      setTab('chat');
                      setIsSidebarOpen(false);
                    }}
                    onCreate={() => {
                      createNewSession();
                      setTab('chat');
                      setIsSidebarOpen(false);
                    }}
                    onDelete={removeSession}
                    onClose={() => setIsSidebarOpen(false)}
                />
              </div>
            </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5 dark:border-white/5 sm:px-4">
            <button
                aria-label="Open sidebar"
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-surface-muted dark:hover:text-slate-200 md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 font-display text-sm font-bold text-white">
                A
              </div>
              <span className="font-display text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100 sm:text-base">
              Aria
            </span>
            </div>

            <nav className="ml-auto flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-surface-muted">
              <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
                Chat
              </TabButton>
              <TabButton active={tab === 'voice'} onClick={() => setTab('voice')}>
                Voice
              </TabButton>
            </nav>

            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </header>

          <main className="min-h-0 flex-1">
            {tab === 'chat' ? (
                <ChatWindow
                    session={activeSession}
                    isSending={isSending}
                    sendError={sendError}
                    onSend={sendUserMessage}
                    onRetry={retryLastMessage}
                    onDismissError={dismissError}
                />
            ) : (
                <VoiceCallPanel />
            )}
          </main>
        </div>
      </div>
  );
}