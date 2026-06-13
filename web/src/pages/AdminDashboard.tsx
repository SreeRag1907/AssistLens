import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminListSessions, adminEndSession, getAdminToken, ApiError } from '../lib/api';
import { signOutAdmin, useAuthVersion, useSignOutPending } from '../lib/auth';
import type { SessionSummary } from '../lib/types';
import { Button, Card, StatusBadge, ThemeToggle, btnClass, AppHeader, PageMain, EmptyState, Spinner } from '../components/ui';

function duration(start: string, end: string | null): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminDashboard() {
  useAuthVersion();
  const signingOut = useSignOutPending();
  const navigate = useNavigate();
  const token = getAdminToken();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const live = sessions.filter((s) => s.status === 'active');
  const hasLive = live.length > 0;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminListSessions(token);
      setSessions(data.sessions);
      setError('');
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        signOutAdmin(navigate);
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ms = hasLive ? 15000 : 60000;
    pollRef.current = setInterval(() => {
      if (!document.hidden) load();
    }, ms);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, hasLive]);

  const handleEnd = useCallback(
    async (id: string) => {
      if (!token) return;
      if (!confirm('End this session? Participants will be disconnected.')) return;
      setEnding(id);
      try {
        await adminEndSession(token, id);
        await load();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Failed to end session.');
      } finally {
        setEnding(null);
      }
    },
    [token, load],
  );

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <AppHeader
        subtitle="Operations"
        actions={
          <>
            {live.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                {live.length} live
              </span>
            )}
            <button
              type="button"
              onClick={() => signOutAdmin(navigate)}
              disabled={!!signingOut}
              className={btnClass('ghost', 'text-sm')}
            >
              Sign out
            </button>
            <ThemeToggle />
          </>
        }
      />

      <PageMain className="max-w-6xl space-y-8">
        <div>
          <p className="section-label">Overview</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Admin dashboard</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total sessions', value: sessions.length },
            { label: 'Live now', value: live.length },
            { label: 'Live participants', value: live.reduce((a, s) => a + Number(s.participant_count ?? 0), 0) },
            {
              label: 'Ended today',
              value: sessions.filter(
                (s) => s.status === 'ended' && s.ended_at && new Date(s.ended_at) > new Date(Date.now() - 86400000),
              ).length,
            },
          ].map((stat) => (
            <Card key={stat.label} className="px-4 py-3">
              <p className="text-2xl font-extrabold tabular-nums text-fg">{stat.value}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{stat.label}</p>
            </Card>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1 w-fit">
          {(['all', 'active', 'ended'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === f ? 'bg-surface text-fg shadow-card border border-line' : 'text-muted hover:text-fg'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Live' : 'Ended'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}
        {error && (
          <Card className="border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </Card>
        )}

        {!loading && filtered.length === 0 && <EmptyState>No sessions to show.</EmptyState>}

        <div className="space-y-2">
          {filtered.map((session) => (
            <Card key={session.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={session.status === 'active' ? 'live' : 'ended'} />
                    <Link
                      to={`/admin/sessions/${session.id}`}
                      className="font-semibold text-sm text-fg truncate hover:text-brand transition-colors"
                    >
                      {session.title ?? 'Untitled session'}
                    </Link>
                    <span className="text-xs text-muted bg-surface-2 rounded-md px-2 py-0.5">
                      {session.agent_email ?? 'Agent'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    <span>Started {fmt(session.created_at)}</span>
                    <span>Duration: {duration(session.created_at, session.ended_at)}</span>
                    <span>
                      {Number(session.participant_count ?? 0)} participant
                      {Number(session.participant_count ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/admin/sessions/${session.id}`} className={btnClass('secondary', 'text-xs px-3 py-1.5')}>
                    Full details
                  </Link>
                  {session.status === 'active' && (
                    <Button
                      variant="danger"
                      className="text-xs px-3 py-1.5"
                      disabled={ending === session.id}
                      onClick={() => handleEnd(session.id)}
                    >
                      {ending === session.id ? 'Ending…' : 'End'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageMain>
    </div>
  );
}
