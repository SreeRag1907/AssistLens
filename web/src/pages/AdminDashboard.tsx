import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminListSessions,
  adminGetParticipants,
  adminGetEvents,
  adminEndSession,
  getAgentToken,
} from '../lib/api';
import type { EventRecord, ParticipantRecord, SessionSummary } from '../lib/types';
import { Button, Card, Logo, StatusBadge, ThemeToggle, btnClass } from '../components/ui';

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

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    session_created: 'Session created',
    session_ended: 'Session ended',
    joined: 'Participant joined',
    disconnected: 'Participant disconnected',
    reconnected: 'Participant reconnected',
    recording_started: 'Recording started',
    recording_stopped: 'Recording stopped',
    recording_ready: 'Recording ready',
    recording_failed: 'Recording failed',
    room_finished: 'Room closed',
    duplicate_join: 'Duplicate join ignored',
  };
  return map[type] ?? type;
}

interface ExpandedState {
  participants: ParticipantRecord[] | null;
  events: EventRecord[] | null;
  loading: boolean;
}

export function AdminDashboard() {
  const token = getAgentToken()!;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, ExpandedState>>({});
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminListSessions(token);
      setSessions(data.sessions);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expanded[id]) {
        setExpanded((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      setExpanded((prev) => ({ ...prev, [id]: { participants: null, events: null, loading: true } }));
      const [pRes, eRes] = await Promise.allSettled([
        adminGetParticipants(token, id),
        adminGetEvents(token, id),
      ]);
      setExpanded((prev) => ({
        ...prev,
        [id]: {
          participants: pRes.status === 'fulfilled' ? pRes.value.participants : [],
          events: eRes.status === 'fulfilled' ? eRes.value.events : [],
          loading: false,
        },
      }));
    },
    [expanded, token],
  );

  const handleEnd = useCallback(
    async (id: string) => {
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

  const live = sessions.filter((s) => s.status === 'active');
  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/agent" className="opacity-70 hover:opacity-100 transition">
            <Logo size={30} />
          </Link>
          <div className="flex-1">
            <span className="text-sm font-semibold text-fg">Admin Dashboard</span>
            <span className="ml-2 text-xs text-muted">Operations view — all agents</span>
          </div>
          {live.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500 ring-1 ring-emerald-500/25">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {live.length} live
            </span>
          )}
          <Link to="/agent" className={btnClass('ghost', 'text-sm')}>
            Agent view
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Sessions', value: sessions.length },
            { label: 'Live Now', value: live.length },
            { label: 'Live Participants', value: live.reduce((a, s) => a + Number(s.participant_count ?? 0), 0) },
            { label: 'Ended Today', value: sessions.filter((s) => s.status === 'ended' && s.ended_at && new Date(s.ended_at) > new Date(Date.now() - 86400000)).length },
          ].map((stat) => (
            <Card key={stat.label} className="px-5 py-4">
              <p className="text-2xl font-bold text-fg">{stat.value}</p>
              <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 w-fit">
          {(['all', 'active', 'ended'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                filter === f ? 'bg-brand text-brand-fg shadow-glow' : 'text-muted hover:text-fg'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Live' : 'Ended'}
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-center text-muted py-16 text-sm">Loading sessions…</p>
        )}
        {error && (
          <Card className="p-4 border-red-500/30 bg-red-500/5">
            <p className="text-sm text-red-400">{error}</p>
          </Card>
        )}

        {/* Session table */}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-muted py-16 text-sm">No sessions to show.</p>
        )}

        <div className="space-y-3">
          {filtered.map((session) => {
            const exp = expanded[session.id];
            return (
              <Card key={session.id} className="overflow-hidden">
                {/* Session row */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={session.status === 'active' ? 'live' : 'ended'} />
                      <span className="font-semibold text-sm text-fg truncate">
                        {session.title ?? 'Untitled Session'}
                      </span>
                      <span className="text-xs text-muted bg-surface-2 rounded-md px-2 py-0.5">
                        {session.agent_email ?? 'Agent'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                      <span>Started {fmt(session.created_at)}</span>
                      <span>Duration: {duration(session.created_at, session.ended_at)}</span>
                      <span>
                        {Number(session.participant_count ?? 0)} participant{Number(session.participant_count ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to={`/agent/history/${session.id}`}
                      className={btnClass('ghost', 'text-xs px-3 py-1.5')}
                    >
                      Detail
                    </Link>
                    <button
                      onClick={() => toggleExpand(session.id)}
                      className={btnClass('secondary', 'text-xs px-3 py-1.5')}
                    >
                      {exp ? 'Hide' : 'Expand'}
                    </button>
                    {session.status === 'active' && (
                      <Button
                        variant="danger"
                        className="text-xs px-3 py-1.5"
                        disabled={ending === session.id}
                        onClick={() => handleEnd(session.id)}
                      >
                        {ending === session.id ? 'Ending…' : 'End Session'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {exp && (
                  <div className="border-t border-line px-5 py-4 bg-bg/40 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {exp.loading ? (
                      <p className="text-xs text-muted col-span-2">Loading…</p>
                    ) : (
                      <>
                        {/* Participants */}
                        <div>
                          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                            Participants
                          </p>
                          {(exp.participants ?? []).length === 0 ? (
                            <p className="text-xs text-muted">No participants yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {(exp.participants ?? []).map((p) => (
                                <div key={p.id} className="flex items-center gap-2 text-xs">
                                  <span
                                    className={`h-2 w-2 rounded-full flex-shrink-0 ${p.left_at ? 'bg-line' : 'bg-emerald-500'}`}
                                  />
                                  <span className="font-medium text-fg">
                                    {p.display_name ?? p.identity}
                                  </span>
                                  <span className="text-muted capitalize">{p.role}</span>
                                  <span className="text-muted ml-auto">
                                    {p.left_at ? `Left ${fmt(p.left_at)}` : `Joined ${fmt(p.joined_at)}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Event log */}
                        <div>
                          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                            Event Log
                          </p>
                          {(exp.events ?? []).length === 0 ? (
                            <p className="text-xs text-muted">No events recorded.</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {(exp.events ?? []).map((ev) => (
                                <div key={ev.id} className="flex items-start gap-2 text-xs">
                                  <span className="text-muted flex-shrink-0 tabular-nums">
                                    {new Date(ev.created_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })}
                                  </span>
                                  <span className="text-fg">{eventLabel(ev.type)}</span>
                                  {ev.identity && (
                                    <span className="text-muted ml-auto truncate">{ev.identity}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
