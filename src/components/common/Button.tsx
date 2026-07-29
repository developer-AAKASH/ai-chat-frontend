import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
      'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-900 disabled:text-slate-400',
  secondary:
      'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 disabled:text-slate-400 dark:bg-surface-muted dark:text-slate-100 dark:hover:bg-slate-700/60 dark:active:bg-slate-700 dark:disabled:text-slate-500',
  ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 disabled:text-slate-400 dark:text-slate-300 dark:hover:bg-surface-muted dark:disabled:text-slate-600',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:bg-red-900 disabled:text-slate-400',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-2.5 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2 gap-2 rounded-xl',
  lg: 'text-base px-5 py-3 gap-2 rounded-xl',
};

export function Button({
     variant = 'primary',
     size = 'md',
     icon,
     children,
     className = '',
     disabled,
     ...rest
}: ButtonProps) {
  return (
      <button
          className={`inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
          disabled={disabled}
          {...rest}
      >
        {icon}
        {children}
      </button>
  );
}