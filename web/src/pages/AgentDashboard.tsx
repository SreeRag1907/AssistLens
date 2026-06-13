import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearAgentToken,
  createSession,
  getAgentToken,
  listSessions,
  ApiError,
} from '../lib/api';
import type { SessionSummary } from '../lib/types';

function durationLabel(s: SessionSummary): string {
  if (!s.ended_at) return s.status === 'active' ? 'live' : '-';
  const ms = new Date(s.ended_at).getTime() - new Date(s.created_at).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${mins} min`;
}

export function AgentDashboard() {
  const navigate = useNavigate();
  const token = getAgentToken();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ url: string; sessionId: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listSessions(token);
      setSessions(res.sessions);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAgentToken();
        navigate('/');
      }
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [token, navigate, refresh]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createSession(token, title || undefined);
      setTitle('');
      setLastInvite({ url: res.invite.url, sessionId: res.session.id });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create session.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAgentToken();
    navigate('/');
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h1 className="text-lg font-bold">AssistLens · Agent console</h1>
        <button onClick={logout} className="text-sm text-white/60 hover:text-white">
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-5">
        <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-white/10">
          <h2 className="mb-3 font-semibold">Start a new support session</h2>
          <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (optional)"
              className="flex-1 rounded-lg bg-white/5 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2 font-semibold hover:bg-brand-500 disabled:opacity-60"
            >
              {busy ? 'Creating...' : 'Create session'}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

          {lastInvite && (
            <div className="mt-4 rounded-xl bg-brand-600/10 p-4 ring-1 ring-brand-500/30">
              <p className="text-sm text-white/80">Share this link with the customer (SMS or email):</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={lastInvite.url}
                  className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm text-white/90"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => navigator.clipboard?.writeText(lastInvite.url)}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                >
                  Copy
                </button>
                <Link
                  to={`/agent/call/${lastInvite.sessionId}`}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold hover:bg-brand-500"
                >
                  Join call
                </Link>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Sessions</h2>
          <div className="space-y-2">
            {sessions.length === 0 && <p className="text-sm text-white/40">No sessions yet.</p>}
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 ring-1 ring-white/10"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.title || 'Untitled session'}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        s.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">
                    {new Date(s.created_at).toLocaleString()} · {s.participant_count ?? 0} joined ·{' '}
                    {durationLabel(s)}
                    {Number(s.live_count ?? 0) > 0 && ` · ${s.live_count} live`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.status === 'active' && (
                    <Link
                      to={`/agent/call/${s.id}`}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold hover:bg-brand-500"
                    >
                      Join
                    </Link>
                  )}
                  <Link
                    to={`/agent/history/${s.id}`}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                  >
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
