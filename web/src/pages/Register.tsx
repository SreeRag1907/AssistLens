import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerAgent, setAgentToken, ApiError } from '../lib/api';
import { Button, Field, Logo, ThemeToggle } from '../components/ui';

export function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      const res = await registerAgent(email, password);
      setAgentToken(res.token, res.agent.email);
      navigate('/agent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      <div className="auth-panel relative hidden flex-col justify-between p-12 text-stone-100 lg:flex">
        <Logo size={34} />
        <div className="max-w-md">
          <p className="section-label text-stone-400">For support teams</p>
          <h1 className="mt-4 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight">
            Your own console.
            <br />
            <span className="text-accent">Your own customers.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-stone-400">
            Each agent gets a private workspace — create sessions, share invite links by SMS or email, and
            help customers over live video. Your admin oversees all sessions company-wide.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-stone-300">
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Only you see your session history
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Customers join with a link — no signup
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Chat, files, and recording built in
            </li>
          </ul>
        </div>
        <p className="text-xs text-stone-500">AssistLens · Agent registration</p>
      </div>

      <div className="auth-form-panel relative flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 lg:justify-end">
          <div className="lg:hidden">
            <Logo size={30} withWordmark />
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10">
          <div className="w-full max-w-[380px] animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-fg">Create agent account</h2>
              <p className="mt-1.5 text-sm text-muted">Register to start supporting customers on video.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label" htmlFor="reg-email">Work email</label>
                <Field
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="reg-password">Password</label>
                <Field
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="reg-confirm">Confirm password</label>
                <Field
                  id="reg-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  minLength={8}
                  required
                />
              </div>
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full py-2.5">
                {busy ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="mt-8 text-center text-xs text-subtle">
              Already have an account?{' '}
              <Link to="/" className="font-semibold text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
