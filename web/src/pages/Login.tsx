import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, setAgentToken, ApiError } from '../lib/api';
import { Button, Logo, ThemeToggle } from '../components/ui';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(email, password);
      setAgentToken(res.token);
      navigate('/agent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand to-brand-strong lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.6" />
                <circle cx="12" cy="12" r="3.4" fill="currentColor" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">AssistLens</span>
          </div>
        </div>
        <div className="relative text-white">
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Help support teams see what customers see.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Owned, private, recordable visual support — your customer is on video in seconds, with no app to
            install.
          </p>
        </div>
        <div className="relative text-sm text-white/70">Real-Time Visual Customer Support Platform</div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-bg px-4 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo size={48} />
            <h1 className="mt-3 text-2xl font-bold text-fg">AssistLens</h1>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-fg">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in to your agent console.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="agent@assistlens.dev"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-fg placeholder:text-subtle outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-fg placeholder:text-subtle outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                required
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500 ring-1 ring-red-500/20">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full py-3">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-subtle">
            Customers join from a short invite link — no account needed.{' '}
            <Link to="/admin/login" className="font-medium text-muted hover:text-fg">
              Admin login →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
