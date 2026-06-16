import type { ReactNode } from 'react';

export function PageHero({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="section-label">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        accent ? 'border-brand/30 bg-brand-soft/50' : 'border-line bg-surface shadow-card'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums tracking-tight ${accent ? 'text-brand' : 'text-fg'}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function SectionBlock({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count?: number;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-fg">{title}</h2>
            {count !== undefined && count > 0 && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted">
                {count}
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
            value === opt.id
              ? 'bg-surface text-fg shadow-sm ring-1 ring-line'
              : 'text-muted hover:text-fg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DataPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function DataTableHead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`hidden border-b border-line bg-surface-2/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-subtle md:grid md:items-center md:gap-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function DataTableRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-3 border-b border-line px-4 py-3.5 last:border-b-0 md:items-center md:gap-4 ${className}`}>
      {children}
    </div>
  );
}

export function Col({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`min-w-0 ${className}`}>{children}</div>;
}

export function MetaLine({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-xs text-muted">{children}</p>;
}

export function PanelActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
