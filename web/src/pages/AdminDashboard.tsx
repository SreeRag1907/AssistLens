import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminListSessions, adminEndSession, getAdminToken, ApiError } from '../lib/api';
import { signOutAdmin, useAuthVersion, useSignOutPending } from '../lib/auth';
import type { SessionSummary } from '../lib/types';
import {
  Button,
  StatusBadge,
  ThemeToggle,
  btnClass,
  AppHeader,
  PageMain,
  EmptyState,
  Spinner,
} from '../components/ui';
import {
  Col,
  DataPanel,
  DataTableHead,
  DataTableRow,
  FilterPills,
  MetaLine,
  PageHero,
  PanelActions,
  SectionBlock,
  StatCard,
  StatGrid,
} from '../components/dashboard';

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

const SESSION_ROW =
  'md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_auto]';

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

  const endedToday = sessions.filter(
    (s) => s.status === 'ended' && s.ended_at && new Date(s.ended_at) > new Date(Date.now() - 86400000),
  ).length;

  const liveParticipants = live.reduce((a, s) => a + Number(s.live_count ?? 0), 0);

  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <AppHeader
        subtitle="Operations"
        actions={
          <>
            {live.length > 0 && (
              <span className="hidden items-center gap-1.5 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                {live.length} live
              </span>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => signOutAdmin(navigate)}
              disabled={!!signingOut}
              className={btnClass('ghost', 'text-sm')}
            >
              Sign out
            </button>
          </>
        }
      />

      <PageMain className="max-w-6xl space-y-8">
        <PageHero
          eyebrow="Operations center"
          title="All support sessions"
          description="Monitor agents, review session activity, and intervene when needed."
        />

        <StatGrid>
          <StatCard label="Total sessions" value={sessions.length} />
          <StatCard label="Live now" value={live.length} accent={live.length > 0} />
          <StatCard label="On calls" value={liveParticipants} hint="Connected now" />
          <StatCard label="Ended today" value={endedToday} />
        </StatGrid>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: `All (${sessions.length})` },
              { id: 'active', label: `Live (${live.length})` },
              {
                id: 'ended',
                label: `Ended (${sessions.filter((s) => s.status === 'ended').length})`,
              },
            ]}
          />
          {!loading && (
            <p className="text-xs text-muted">
              Showing {filtered.length} session{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && filtered.length === 0 && <EmptyState>No sessions match this filter.</EmptyState>}

        {!loading && filtered.length > 0 && (
          <SectionBlock title="Sessions" count={filtered.length}>
            <DataPanel>
              <DataTableHead className={SESSION_ROW}>
                <Col>Status</Col>
                <Col>Session</Col>
                <Col>Agent</Col>
                <Col>Started</Col>
                <Col>Duration</Col>
                <Col>Participants</Col>
                <Col className="text-right">Actions</Col>
              </DataTableHead>
              {filtered.map((session) => (
                <DataTableRow key={session.id} className={SESSION_ROW}>
                  <Col>
                    <StatusBadge status={session.status === 'active' ? 'live' : 'ended'} />
                  </Col>
                  <Col>
                    <Link
                      to={`/admin/sessions/${session.id}`}
                      className="block truncate font-semibold text-fg hover:text-brand transition-colors"
                    >
                      {session.title ?? 'Untitled session'}
                    </Link>
                  </Col>
                  <Col>
                    <span className="truncate text-sm text-muted">{session.agent_email ?? '—'}</span>
                  </Col>
                  <Col>
                    <span className="text-sm text-muted">{fmt(session.created_at)}</span>
                  </Col>
                  <Col>
                    <span className="text-sm text-fg">{duration(session.created_at, session.ended_at)}</span>
                  </Col>
                  <Col>
                    <span className="text-sm text-fg">{Number(session.participant_count ?? 0)}</span>
                    {session.status === 'active' && Number(session.live_count ?? 0) > 0 && (
                      <MetaLine>{Number(session.live_count)} live</MetaLine>
                    )}
                  </Col>
                  <Col className="md:text-right">
                    <PanelActions>
                      <Link
                        to={`/admin/sessions/${session.id}`}
                        className={btnClass('secondary', 'text-xs px-3 py-1.5')}
                      >
                        View
                      </Link>
                      {session.status === 'active' && (
                        <Button
                          variant="danger"
                          className="text-xs px-3 py-1.5"
                          disabled={ending === session.id}
                          onClick={() => handleEnd(session.id)}
                        >
                          {ending === session.id ? '…' : 'End'}
                        </Button>
                      )}
                    </PanelActions>
                  </Col>
                </DataTableRow>
              ))}
            </DataPanel>
          </SectionBlock>
        )}
      </PageMain>
    </div>
  );
}
