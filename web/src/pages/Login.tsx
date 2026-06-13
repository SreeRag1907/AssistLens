import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, setAgentToken, ApiError } from '../lib/api';
import { Button, Field, Logo, ThemeToggle } from '../components/ui';

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
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      {/* Editorial panel */}
      <div className="auth-panel relative hidden flex-col justify-between p-12 text-stone-100 lg:flex">
        <Logo size={34} />
        <div className="max-w-md">
          <p className="section-label text-stone-400">Visual customer support</p>
          <h1 className="mt-4 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight">
            See the problem.
            <br />
            <span className="text-accent">Solve it faster.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-stone-400">
            Live video sessions with no app install. Share a link, join from any browser, troubleshoot with
            chat and file sharing — routed through your own infrastructure.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-stone-300">
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Self-hosted SFU — no third-party video API
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Pre-join device check before every call
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Recording, chat, and file sharing built in
            </li>
          </ul>
        </div>
        <p className="text-xs text-stone-500">AssistLens · Real-time support platform</p>
      </div>

      {/* Sign-in */}
      <div className="relative flex flex-col bg-bg">
        <div className="flex items-center justify-between px-5 py-4 lg:justify-end">
          <div className="lg:hidden">
            <Logo size={30} withWordmark />
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10">
          <div className="w-full max-w-[380px] animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-fg">Agent sign in</h2>
              <p className="mt-1.5 text-sm text-muted">Access your support console.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <Field
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <Field
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
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
              Customers join via invite link — no account required.{' '}
              <Link to="/admin/login" className="font-semibold text-brand hover:underline">
                Admin access
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
