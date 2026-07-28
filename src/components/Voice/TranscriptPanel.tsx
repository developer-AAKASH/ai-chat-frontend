import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../../types';

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
}

export function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length, entries[entries.length - 1]?.text]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
        Your live transcript will appear here once the call connects.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
      {entries.map((entry) => (
        <div key={entry.id} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <p
            className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[70%] ${
              entry.role === 'user'
                ? `bg-brand-500/90 text-white ${!entry.isFinal ? 'opacity-60 italic' : ''}`
                : 'bg-surface-muted text-slate-100'
            }`}
          >
            {entry.text}
          </p>
        </div>
      ))}
    </div>
  );
}
