import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearAgentToken,
  createSession,
  endSession,
  getAgentToken,
  getInvite,
  listSessions,
  ApiError,
} from '../lib/api';
import type { SessionSummary } from '../lib/types';
import { btnClass, Button, Card, Logo, StatusBadge, ThemeToggle } from '../components/ui';
import { ShareDialog } from '../components/ShareDialog';

function durationLabel(s: SessionSummary): string {
  if (!s.ended_at) return s.status === 'active' ? 'live' : '—';
  const ms = new Date(s.ended_at).getTime() - new Date(s.created_at).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${mins} min`;
}

interface ShareState {
  open: boolean;
  url: string | null;
  loading: boolean;
  error: string | null;
}

export function AgentDashboard() {
  const navigate = useNavigate();
  const token = getAgentToken();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareState>({ open: false, url: null, loading: false, error: null });

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
      setShare({ open: true, url: res.invite.url, loading: false, error: null });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create session.');
    } finally {
      setBusy(false);
    }
  }

  async function openShare(id: string) {
    if (!token) return;
    setShare({ open: true, url: null, loading: true, error: null });
    try {
      const res = await getInvite(token, id);
      setShare({ open: true, url: res.url, loading: false, error: null });
    } catch (err) {
      setShare({
        open: true,
        url: null,
        loading: false,
        error: err instanceof ApiError ? err.message : 'Could not generate a link.',
      });
    }
  }

  async function end(id: string) {
    if (!token) return;
    try {
      await endSession(token, id);
      await refresh();
    } catch {
      /* ignore */
    }
  }

  function logout() {
    clearAgentToken();
    navigate('/');
  }

  const live = sessions.filter((s) => s.status === 'active');
  const recent = sessions.filter((s) => s.status !== 'active');

  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
          <Logo size={34} withWordmark />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={logout} className={btnClass('ghost', 'px-3 py-2')}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-5 py-7">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold">Hello, Agent 👋</h1>
          <p className="mt-1 text-sm text-muted">Create a session and share the link to get a customer on video.</p>
        </div>

        {/* Create session */}
        <Card className="animate-fade-in p-5 sm:p-6">
          <h2 className="text-base font-semibold">Start a new support session</h2>
          <p className="mt-0.5 text-sm text-muted">Generate a private invite link for your customer.</p>
          <form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title (optional) — e.g. Router setup"
              className="flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-fg placeholder:text-subtle outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <Button type="submit" disabled={busy} className="sm:px-6">
              {busy ? 'Creating…' : 'Create session'}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </Card>

        {/* Live sessions */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Live sessions</h2>
            {live.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                {live.length}
              </span>
            )}
          </div>
          {live.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">No live sessions right now.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {live.map((s) => (
                <Card key={s.id} className="flex flex-col p-4 transition hover:border-brand/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.title || 'Untitled session'}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {s.participant_count ?? 0} joined
                        {Number(s.live_count ?? 0) > 0 && ` · ${s.live_count} on call`}
                      </p>
                    </div>
                    <StatusBadge status="live" />
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link to={`/agent/call/${s.id}`} className={btnClass('primary', 'flex-1')}>
                      Join
                    </Link>
                    <button onClick={() => openShare(s.id)} className={btnClass('secondary')}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                        <path d="M18 8a3 3 0 1 0-2.8-4H15a3 3 0 0 0 .2 1.1L8.9 8.6a3 3 0 1 0 0 6.8l6.3 3.5A3 3 0 1 0 18 16a3 3 0 0 0-2 .8l-6.1-3.4a3 3 0 0 0 0-2.8L16 7.2A3 3 0 0 0 18 8Z" />
                      </svg>
                      Share
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Link
                      to={`/agent/history/${s.id}`}
                      className="text-xs font-medium text-muted transition hover:text-fg"
                    >
                      View details
                    </Link>
                    <button
                      onClick={() => end(s.id)}
                      className="text-xs font-semibold text-red-500 transition hover:text-red-400"
                    >
                      End session
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent sessions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Recent sessions</h2>
          {recent.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">No past sessions yet.</Card>
          ) : (
            <Card className="divide-y divide-line">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  to={`/agent/history/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.title || 'Untitled session'}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(s.created_at).toLocaleString()} · {s.participant_count ?? 0} joined ·{' '}
                      {durationLabel(s)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={s.status} />
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-subtle" fill="none" aria-hidden>
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </section>
      </main>

      <ShareDialog
        open={share.open}
        url={share.url}
        loading={share.loading}
        error={share.error}
        onClose={() => setShare((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
