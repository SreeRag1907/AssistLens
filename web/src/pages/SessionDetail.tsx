import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getAgentToken,
  getInvite,
  getMessages,
  getSession,
  listFiles,
  listRecordings,
  downloadRecording,
  downloadFile,
  ApiError,
} from '../lib/api';
import type { ChatFile, ChatMessage, EventRecord, ParticipantRecord, RecordingRecord, SessionSummary } from '../lib/types';
import { btnClass, Button, Card, Logo, StatusBadge, ThemeToggle } from '../components/ui';
import { ShareDialog } from '../components/ShareDialog';

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}
function dur(a: string, b: string | null): string {
  if (!b) return 'still in session';
  const mins = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${mins} min`;
}

export function SessionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const token = getAgentToken();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [share, setShare] = useState<{ open: boolean; url: string | null; loading: boolean; error: string | null }>({
    open: false,
    url: null,
    loading: false,
    error: null,
  });

  async function openShare() {
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

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    (async () => {
      try {
        const [res, msgRes, fileRes] = await Promise.all([
          getSession(token, id),
          getMessages(token, id),
          listFiles(token, id).catch(() => ({ files: [] as ChatFile[] })),
        ]);
        setSession(res.session);
        setParticipants(res.participants);
        setEvents(res.events);
        setRecordings(res.recordings);
        setMessages(msgRes.messages);
        setFiles(fileRes.files);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load session.');
      }
    })();
  }, [token, id, navigate]);

  // Poll recording status when any recording is processing/in_progress
  useEffect(() => {
    if (!token) return;
    const hasPending = recordings.some(
      (r) => r.status === 'in_progress' || r.status === 'processing',
    );
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await listRecordings(token, id);
          setRecordings(res.recordings);
          const stillPending = res.recordings.some(
            (r) => r.status === 'in_progress' || r.status === 'processing',
          );
          if (!stillPending && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch {
          /* ignore */
        }
      }, 5000);
    }
    if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings.map((r) => r.status).join(','), token, id]);

  async function download(rid: string, objectKey: string | null) {
    if (!token) return;
    setDownloadBusy(rid);
    setDownloadMsg(null);
    try {
      const fileName = objectKey?.split('/').pop() ?? 'recording.mp4';
      await downloadRecording(token, id, rid, fileName);
      setDownloadMsg({ id: rid, msg: 'Download started.', ok: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Recording not ready.';
      setDownloadMsg({ id: rid, msg, ok: false });
      // Refresh status if file was missing
      if (err instanceof ApiError && (err.status === 404 || err.code === 'file_missing')) {
        listRecordings(token, id).then((r) => setRecordings(r.recordings)).catch(() => {});
      }
    } finally {
      setDownloadBusy(null);
    }
  }

  async function downloadSharedFile(fileId: string, fileName: string) {
    if (!token) return;
    try {
      await downloadFile(token, id, fileId, fileName);
    } catch {
      alert('Could not download file. Please try again.');
    }
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg text-fg">
        <p className="text-muted">{error}</p>
        <Link to="/agent" className={btnClass('primary', 'mt-4')}>
          Back to console
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Logo size={30} />
            <div>
              <Link to="/agent" className="text-xs text-muted transition hover:text-fg">
                ← Back to console
              </Link>
              <h1 className="text-base font-bold leading-tight">{session?.title || 'Session detail'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session?.status === 'active' && (
              <>
                <Button variant="secondary" onClick={openShare}>
                  Share
                </Button>
                <Link to={`/agent/call/${id}`} className={btnClass('primary')}>
                  Rejoin
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-5 py-6">
        {session && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <StatusBadge status={session.status} />
            <span>Created {fmt(session.created_at)}</span>
            {session.ended_at && <span>· Ended {fmt(session.ended_at)}</span>}
          </div>
        )}

        <Section title="Participants" count={participants.length}>
          {participants.length === 0 ? (
            <Empty>No participants recorded.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-strong text-sm font-semibold text-white">
                      {(p.display_name || p.identity).trim().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.display_name || p.identity}</p>
                      <span className="text-[11px] uppercase tracking-wide text-subtle">{p.role}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted">
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
                    <span className="text-muted">{fmt(r.created_at)}</span>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={r.status} />
                      {(r.status === 'in_progress' || r.status === 'processing') && (
                        <span className="flex items-center gap-1.5 text-xs text-amber-500">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                          {r.status === 'in_progress' ? 'Recording…' : 'Processing…'}
                        </span>
                      )}
                      {r.status === 'ready' && (
                        <Button
                          onClick={() => download(r.id, r.object_key)}
                          disabled={downloadBusy === r.id}
                          className="px-3 py-1.5 text-xs"
                        >
                          {downloadBusy === r.id ? 'Getting link…' : 'Download'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {downloadMsg?.id === r.id && (
                    <p
                      className={`text-xs ${downloadMsg.ok ? 'text-emerald-500' : 'text-red-400'}`}
                    >
                      {downloadMsg.msg}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Shared Files" count={files.length}>
          {files.length === 0 ? (
            <Empty>No files were shared in this session.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{f.file_name}</p>
                    <p className="text-xs text-muted">
                      {f.sender_name ?? f.sender_identity} · {fmt(f.created_at)} ·{' '}
                      {(f.file_size / 1024).toFixed(0)} KB
                    </p>
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
            <ul className="space-y-2.5 text-sm">
              {messages.map((m) => (
                <li key={m.id} className="flex gap-2">
                  <span className="shrink-0 font-mono text-xs text-subtle">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>
                    <b className="text-fg">{m.sender_name || m.sender_role}:</b>{' '}
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
            <ul className="space-y-1.5 text-xs">
              {events.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="shrink-0 font-mono text-subtle">
                    {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-fg">{e.type}</span>
                  {e.identity && <span className="text-subtle">· {e.identity}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
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

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">{count}</span>
        )}
      </div>
      {children}
    </Card>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-subtle">{children}</p>;
}
