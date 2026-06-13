import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminLogin, setAdminToken, ApiError } from '../lib/api';
import { Button, Field, Logo, ThemeToggle } from '../components/ui';

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
    <div className="relative flex min-h-[100dvh] flex-col bg-bg">
      <div className="flex items-center justify-between px-5 py-4">
        <Logo size={30} withWordmark />
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-12">
        <div className="w-full max-w-[380px] animate-fade-in">
          <div className="mb-2">
            <span className="inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Operations
            </span>
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-fg">Admin sign in</h1>
            <p className="mt-1.5 text-sm text-muted">Monitor sessions, participants, and event logs.</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label" htmlFor="admin-email">Email</label>
              <Field
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-password">Password</label>
              <Field
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full py-2.5">
              {busy ? 'Signing in…' : 'Continue'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-subtle">
            Support agent?{' '}
            <Link to="/" className="font-semibold text-brand hover:underline">
              Agent sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
