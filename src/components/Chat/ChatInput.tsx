import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex items-end gap-2 border-t border-white/5 bg-surface-raised px-3 py-3 sm:px-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          autoGrow(e.target);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Message the assistant…"
        rows={1}
        aria-label="Message input"
        disabled={disabled}
        className="max-h-40 flex-1 resize-none rounded-xl border border-white/10 bg-surface px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none disabled:opacity-60"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        size="md"
        icon={
          disabled ? (
            <Spinner size={16} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12L20 4L13 20L11 13L4 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          )
        }
      >
        <span className="hidden sm:inline">Send</span>
      </Button>
    </div>
  );
}
