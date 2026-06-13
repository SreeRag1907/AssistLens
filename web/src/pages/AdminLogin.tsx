import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminLogin, setAdminToken, ApiError } from '../lib/api';
import { Button, Logo, ThemeToggle } from '../components/ui';

export function AdminLogin() {
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
      const res = await adminLogin(email, password);
      setAdminToken(res.token);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="absolute left-4 top-4">
        <Logo size={32} withWordmark />
      </div>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm animate-fade-in rounded-3xl border border-line bg-surface p-8 shadow-card">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-600 ring-1 ring-amber-500/25">
            Operations
          </span>
          <h1 className="mt-3 text-2xl font-bold text-fg">Admin sign in</h1>
          <p className="mt-1 text-sm text-muted">Monitor all sessions and end calls when needed.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg">Admin email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@assistlens.dev"
              className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              required
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy ? 'Signing in…' : 'Sign in to admin'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-subtle">
          Support agent?{' '}
          <Link to="/" className="font-medium text-brand hover:underline">
            Agent login
          </Link>
        </p>
      </div>
    </div>
  );
}
