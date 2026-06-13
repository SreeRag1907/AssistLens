import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminDownloadFile,
  adminDownloadRecording,
  adminEndSession,
  adminGetSessionDetail,
  adminListRecordings,
  ApiError,
  getAdminToken,
} from '../lib/api';
import { signOutAdmin, useSignOutPending } from '../lib/auth';
import type { ChatFile, ChatMessage, EventRecord, ParticipantRecord, RecordingRecord, SessionSummary } from '../lib/types';
import {
  AppHeader,
  btnClass,
  Button,
  Card,
  PageMain,
  Spinner,
  StatusBadge,
  ThemeToggle,
} from '../components/ui';

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}

function dur(a: string, b: string | null): string {
  if (!b) return 'still in session';
  const mins = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${mins} min`;
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

export function AdminSessionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const signingOut = useSignOutPending();
  const token = getAdminToken();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const res = await adminGetSessionDetail(token, id);
        setSession(res.session);
        setInviteUrl(res.invite?.url ?? null);
        setParticipants(res.participants);
        setEvents(res.events);
        setRecordings(res.recordings);
        setMessages(res.messages);
        setFiles(res.files);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load session.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, id, navigate]);

  useEffect(() => {
    if (!token) return;
    const pending = recordings.some((r) => r.status === 'in_progress' || r.status === 'processing');

    if (pending && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await adminListRecordings(token, id);
          setRecordings(res.recordings);
        } catch {
          /* ignore */
        }
      }, 8000);
    }
    if (!pending && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [recordings, token, id]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  async function handleEnd() {
    if (!token || !session) return;
    if (!confirm('End this session? All participants will be disconnected.')) return;
    setEnding(true);
    try {
      await adminEndSession(token, id);
      const res = await adminGetSessionDetail(token, id);
      setSession(res.session);
      setEvents(res.events);
      setParticipants(res.participants);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to end session.');
    } finally {
      setEnding(false);
    }
  }

  async function downloadRecording(rid: string, objectKey: string | null) {
    if (!token) return;
    setDownloadBusy(rid);
    setDownloadMsg(null);
    try {
      const fileName = objectKey?.split('/').pop() ?? 'recording.mp4';
      await adminDownloadRecording(token, id, rid, fileName);
      setDownloadMsg({ id: rid, msg: 'Download started.', ok: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Recording not ready.';
      setDownloadMsg({ id: rid, msg, ok: false });
      if (err instanceof ApiError && (err.status === 404 || err.code === 'file_missing')) {
        adminListRecordings(token, id).then((r) => setRecordings(r.recordings)).catch(() => {});
      }
    } finally {
      setDownloadBusy(null);
    }
  }

  async function downloadSharedFile(fileId: string, fileName: string) {
    if (!token) return;
    try {
      await adminDownloadFile(token, id, fileId, fileName);
    } catch {
      alert('Could not download file.');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg text-fg">
        <Spinner />
        <p className="mt-4 text-sm text-muted">Loading session…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg text-fg">
        <p className="text-muted">{error ?? 'Session not found.'}</p>
        <Link to="/admin" className={btnClass('primary', 'mt-4')}>Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <AppHeader
        back={{ to: '/admin', label: 'Dashboard' }}
        title={session.title || 'Session detail'}
        actions={
          <>
            <ThemeToggle />
            {session.status === 'active' && (
              <Button variant="danger" disabled={ending} onClick={handleEnd}>
                {ending ? 'Ending…' : 'End session'}
              </Button>
            )}
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

      <PageMain className="max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusBadge status={session.status === 'active' ? 'live' : 'ended'} />
          <span className="text-sm text-muted">Created {fmt(session.created_at)}</span>
          {session.ended_at && <span className="text-sm text-muted">· Ended {fmt(session.ended_at)}</span>}
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-fg">Session metadata</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Meta label="Session ID" value={session.id} mono />
            <Meta label="Agent" value={session.agent_email ?? '—'} />
            <Meta label="Room" value={session.room_name} mono />
            <Meta label="Ended by" value={session.ended_by ?? '—'} />
            <Meta label="Invite code" value={session.invite_code ?? '—'} mono />
            <Meta
              label="Invite link"
              value={inviteUrl ?? '—'}
              mono
              link={inviteUrl}
            />
          </dl>
        </Card>

        <Section title="Participants" count={participants.length}>
          {participants.length === 0 ? (
            <Empty>No participants recorded.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg">
                      {(p.display_name || p.identity).trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name || p.identity}</p>
                      <p className="text-[11px] font-mono text-subtle truncate">{p.identity}</p>
                      <span className="text-[11px] uppercase tracking-wide text-subtle">{p.role}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted shrink-0">
                    <div>joined {fmt(p.joined_at)}</div>
                    <div className="text-subtle">{dur(p.joined_at, p.left_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recordings" count={recordings.length}>
          {recordings.length === 0 ? (
            <Empty>No recordings for this session.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recordings.map((r) => (
                <li key={r.id} className="space-y-1.5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-muted">{r.id.slice(0, 8)}…</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{fmt(r.created_at)}</span>
                      <StatusBadge status={r.status} />
                      {r.status === 'ready' && (
                        <Button
                          onClick={() => downloadRecording(r.id, r.object_key)}
                          disabled={downloadBusy === r.id}
                          className="px-3 py-1.5 text-xs"
                        >
                          {downloadBusy === r.id ? 'Getting…' : 'Download'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {r.object_key && (
                    <p className="text-xs font-mono text-subtle truncate">{r.object_key}</p>
                  )}
                  {downloadMsg?.id === r.id && (
                    <p className={`text-xs ${downloadMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {downloadMsg.msg}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Shared files" count={files.length}>
          {files.length === 0 ? (
            <Empty>No files were shared in this session.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-medium text-fg" title={f.file_name}>{f.file_name}</p>
                    <p className="text-xs text-muted">
                      {f.sender_name ?? f.sender_identity} · {fmt(f.created_at)} · {(f.file_size / 1024).toFixed(0)} KB
                    </p>
                    <p className="text-xs text-subtle">{f.content_type}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => downloadSharedFile(f.id, f.file_name)}
                    className="shrink-0 px-3 py-1.5 text-xs"
                  >
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Chat transcript" count={messages.length}>
          {messages.length === 0 ? (
            <Empty>No messages.</Empty>
          ) : (
            <ul className="space-y-2.5 text-sm max-h-96 overflow-y-auto pr-1">
              {messages.map((m) => (
                <li key={m.id} className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-subtle">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>
                    <b className="text-fg">{m.sender_name || m.sender_role}</b>
                    <span className="text-subtle text-xs"> ({m.sender_identity})</span>:{' '}
                    <span className="text-muted">{m.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Event log" count={events.length}>
          {events.length === 0 ? (
            <Empty>No events.</Empty>
          ) : (
            <ul className="space-y-1.5 text-xs max-h-80 overflow-y-auto pr-1">
              {events.map((e) => (
                <li key={e.id} className="flex gap-2 border-b border-line/50 pb-1.5 last:border-0">
                  <span className="shrink-0 font-mono text-subtle tabular-nums">
                    {new Date(e.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="font-semibold text-fg">{eventLabel(e.type)}</span>
                  {e.identity && <span className="text-subtle truncate">· {e.identity}</span>}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <span className="text-subtle font-mono truncate ml-auto">
                      {JSON.stringify(e.metadata)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageMain>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`mt-0.5 text-fg ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">{count}</span>
        )}
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-subtle">{children}</p>;
}
