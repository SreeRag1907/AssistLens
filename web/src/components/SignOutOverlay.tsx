import { Logo, Spinner } from './ui';

interface Props {
  label?: string;
}

/** Full-screen overlay while signing out — shown before navigation to login. */
export function SignOutOverlay({ label = 'Signing out…' }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Logo size={40} withWordmark />
      <Spinner className="mt-8 h-9 w-9 text-brand" />
      <p className="mt-4 text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
