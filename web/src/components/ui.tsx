import { useTheme } from '../lib/theme';

// ── Logo — flat aperture mark, no gradients ─────────────────────────────────
export function Logo({ size = 32, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-lg bg-brand text-brand-fg"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path
            d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M16.9 16.9l2.1 2.1M4.9 19.1l2.1-2.1M16.9 7.1l2.1-2.1"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {withWordmark && (
        <span className="text-[15px] font-bold tracking-tight text-fg">
          Assist<span className="text-brand">Lens</span>
        </span>
      )}
    </div>
  );
}

// ── Theme toggle ─────────────────────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-brand/50 hover:text-fg"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-strong disabled:opacity-50',
  secondary: 'border border-line bg-surface text-fg hover:bg-surface-2 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
};

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98]';

export function btnClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${buttonBase} ${buttonStyles[variant]} ${extra}`;
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={btnClass(variant, className)} {...rest}>
      {children}
    </button>
  );
}

// ── Form primitives ────────────────────────────────────────────────────────────
export function Field({
  className = '',
  muted,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { muted?: boolean }) {
  return <input className={muted ? `field-muted ${className}` : `field ${className}`} {...rest} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`field ${className}`} {...rest}>
      {children}
    </select>
  );
}

// ── Card & layout ────────────────────────────────────────────────────────────
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-card ${className}`}>{children}</div>
  );
}

export function AppHeader({
  children,
  actions,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-4 min-w-0">
          <Logo size={30} withWordmark />
          {children}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function PageMain({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <main className={`mx-auto max-w-5xl px-5 py-8 ${className}`}>{children}</main>;
}

// ── Status badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'text-brand border-brand/40 bg-brand/10',
    live: 'text-brand border-brand/40 bg-brand/10',
    ended: 'text-muted border-line bg-surface-2',
    ready: 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-400',
    processing: 'text-amber-600 border-amber-500/30 bg-amber-500/10 dark:text-amber-400',
    in_progress: 'text-amber-600 border-amber-500/30 bg-amber-500/10 dark:text-amber-400',
    failed: 'text-red-600 border-red-500/30 bg-red-500/10 dark:text-red-400',
  };
  const tone = map[status] ?? 'text-muted border-line bg-surface-2';
  const isLive = status === 'active' || status === 'live';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
    >
      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />}
      {status.replace('_', ' ')}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-2/50 px-6 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-line border-t-brand ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
