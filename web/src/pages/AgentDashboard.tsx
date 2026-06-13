import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createSession,
  endSession,
  getAgentEmail,
  getAgentToken,
  getInvite,
  listSessions,
  ApiError,
} from '../lib/api';
import { signOutAgent, useAuthVersion, useSignOutPending } from '../lib/auth';
import type { SessionSummary } from '../lib/types';
import {
  AppHeader,
  btnClass,
  Button,
  Card,
  EmptyState,
  Field,
  PageMain,
  StatusBadge,
  ThemeToggle,
} from '../components/ui';
import { ShareDialog } from '../components/ShareDialog';

function durationLabel(s: SessionSummary): string {
  if (!s.ended_at) return s.status === 'active' ? 'In progress' : '—';
  const ms = new Date(s.ended_at).getTime() - new Date(s.created_at).getTime();
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${mins} min`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ShareState {
  open: boolean;
  url: string | null;
  sessionTitle?: string;
  loading: boolean;
  error: string | null;
}

export function AgentDashboard() {
  useAuthVersion();
  const signingOut = useSignOutPending();
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
        signOutAgent(navigate);
      }
    }
  }, [token, navigate]);

  const hasLive = sessions.some((s) => s.status === 'active');

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (!token) return;
    const ms = hasLive ? 8000 : 60000;
    const t = setInterval(() => {
      if (!document.hidden) refresh();
    }, ms);
    return () => clearInterval(t);
  }, [token, refresh, hasLive]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const sessionTitle = title || undefined;
      const res = await createSession(token, sessionTitle);
      setTitle('');
      setShare({
        open: true,
        url: res.invite.url,
        sessionTitle: res.session.title ?? sessionTitle,
        loading: false,
        error: null,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create session.');
    } finally {
      setBusy(false);
    }
  }

  async function openShare(id: string, sessionTitle?: string) {
    if (!token) return;
    setShare({ open: true, url: null, sessionTitle, loading: true, error: null });
    try {
      const res = await getInvite(token, id);
      setShare({ open: true, url: res.url, sessionTitle, loading: false, error: null });
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
    signOutAgent(navigate);
  }

  const live = sessions.filter((s) => s.status === 'active');
  const recent = sessions.filter((s) => s.status !== 'active');

  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <AppHeader
        subtitle={getAgentEmail() ?? 'Agent console'}
        actions={
          <>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              disabled={!!signingOut}
              className={btnClass('ghost', 'text-sm')}
            >
              Sign out
            </button>
          </>
        }
      />

      <PageMain className="space-y-10">
        <div className="animate-fade-in">
          <p className="section-label">Your workspace</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Sessions</h1>
          <p className="mt-1 text-sm text-muted">
            Create a session, then share the invite link with your customer by SMS or email.
          </p>
        </div>

        {/* New session toolbar */}
        <section className="animate-fade-in">
          <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="label" htmlFor="session-title">New session</label>
              <Field
                id="session-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional title — e.g. Router setup help"
              />
            </div>
            <Button type="submit" disabled={busy} className="sm:px-6 sm:py-2.5">
              {busy ? 'Creating…' : 'Create & share'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>

        {/* Live sessions */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-sm font-bold text-fg">Live now</h2>
            {live.length > 0 && (
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                {live.length}
              </span>
            )}
          </div>

          {live.length === 0 ? (
            <EmptyState>No active sessions. Create one above to get started.</EmptyState>
          ) : (
            <div className="space-y-2">
              {live.map((s) => (
                <Card key={s.id} className="live-rail overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge status="live" />
                        <p className="truncate font-semibold">{s.title || 'Untitled session'}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {s.participant_count ?? 0} joined
                        {Number(s.live_count ?? 0) > 0 && ` · ${s.live_count} on call`}
                        {' · Started '}{fmtDate(s.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/agent/call/${s.id}`} className={btnClass('primary', 'flex-1 sm:flex-none')}>
                        Join call
                      </Link>
                      <button onClick={() => openShare(s.id, s.title ?? undefined)} className={btnClass('secondary')}>
                        Share
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-4 py-2.5 bg-surface-2/50">
                    <Link
                      to={`/agent/history/${s.id}`}
                      className="text-xs font-medium text-muted transition hover:text-fg"
                    >
                      View details
                    </Link>
                    <button
                      onClick={() => end(s.id)}
                      className="text-xs font-semibold text-red-600 transition hover:text-red-500 dark:text-red-400"
                    >
                      End session
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="mb-4 text-sm font-bold text-fg">History</h2>
          {recent.length === 0 ? (
            <EmptyState>No past sessions yet.</EmptyState>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {recent.map((s) => (
                <Link key={s.id} to={`/agent/history/${s.id}`} className="data-row group">
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:text-brand transition-colors">
                      {s.title || 'Untitled session'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {fmtDate(s.created_at)} · {s.participant_count ?? 0} joined · {durationLabel(s)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={s.status} />
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-subtle" fill="none" aria-hidden>
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </section>
      </PageMain>

      <ShareDialog
        open={share.open}
        url={share.url}
        title={share.sessionTitle}
        loading={share.loading}
        error={share.error}
        onClose={() => setShare((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
