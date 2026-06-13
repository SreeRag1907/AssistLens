import { useTheme } from '../lib/theme';

// ── Brand logo ──────────────────────────────────────────────────────────────
export function Logo({ size = 36, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-white shadow-glow"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.55" />
          <circle cx="12" cy="12" r="3.4" fill="currentColor" />
        </svg>
      </div>
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight text-fg">
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
      className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:text-fg hover:border-brand/40"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-fg hover:bg-brand-strong shadow-glow disabled:opacity-60 disabled:shadow-none',
  secondary: 'border border-line bg-surface text-fg hover:bg-surface-2 disabled:opacity-60',
  danger: 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-60',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
};

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]';

// Shared class string so anchors/links can look like buttons without nesting
// a <button> inside an <a>.
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

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>{children}</div>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    live: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    ended: 'bg-line/60 text-muted ring-line',
    ready: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25',
    processing: 'bg-amber-500/15 text-amber-500 ring-amber-500/25',
    in_progress: 'bg-amber-500/15 text-amber-500 ring-amber-500/25',
    failed: 'bg-red-500/15 text-red-500 ring-red-500/25',
  };
  const tone = map[status] ?? 'bg-line/60 text-muted ring-line';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${tone}`}
    >
      {(status === 'active' || status === 'live') && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      )}
      {status.replace('_', ' ')}
    </span>
  );
}
