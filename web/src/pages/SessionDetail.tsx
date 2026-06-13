import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getAgentToken,
  getMessages,
  getRecordingUrl,
  getSession,
  ApiError,
} from '../lib/api';
import type { ChatMessage, EventRecord, ParticipantRecord, RecordingRecord, SessionSummary } from '../lib/types';

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : '-';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    (async () => {
      try {
        const res = await getSession(token, id);
        setSession(res.session);
        setParticipants(res.participants);
        setEvents(res.events);
        setRecordings(res.recordings);
        const m = await getMessages(token, id);
        setMessages(m.messages);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load session.');
      }
    })();
  }, [token, id, navigate]);

  async function download(rid: string) {
    if (!token) return;
    try {
      const res = await getRecordingUrl(token, id, rid);
      window.open(res.url, '_blank');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Recording not ready.');
    }
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 text-white">
        <p>{error}</p>
        <Link to="/agent" className="mt-4 rounded-lg bg-brand-600 px-4 py-2">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <Link to="/agent" className="text-sm text-white/50 hover:text-white">
            ← Console
          </Link>
          <h1 className="text-lg font-bold">{session?.title || 'Session detail'}</h1>
        </div>
        {session?.status === 'active' && (
          <Link to={`/agent/call/${id}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold">
            Rejoin
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-5">
        <Card title="Participants">
          {participants.length === 0 ? (
            <Empty>No participants recorded.</Empty>
          ) : (
            <ul className="divide-y divide-white/5">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{p.display_name || p.identity}</span>
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">
                      {p.role}
                    </span>
                  </div>
                  <div className="text-right text-xs text-white/40">
                    <div>joined {fmt(p.joined_at)}</div>
                    <div>{dur(p.joined_at, p.left_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recordings">
          {recordings.length === 0 ? (
            <Empty>No recordings for this session.</Empty>
          ) : (
            <ul className="space-y-2">
              {recordings.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{fmt(r.created_at)}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        r.status === 'ready'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : r.status === 'failed'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.status === 'ready' && (
                      <button onClick={() => download(r.id)} className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold">
                        Download
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Chat transcript">
          {messages.length === 0 ? (
            <Empty>No messages.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {messages.map((m) => (
                <li key={m.id}>
                  <span className="text-white/50">
                    [{new Date(m.created_at).toLocaleTimeString()}] {m.sender_name || m.sender_role}:
                  </span>{' '}
                  <span className="text-white/90">{m.body}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Event log">
          <ul className="space-y-1 text-xs text-white/60">
            {events.map((e) => (
              <li key={e.id}>
                <span className="text-white/40">{new Date(e.created_at).toLocaleTimeString()}</span>{' '}
                <span className="font-medium text-white/80">{e.type}</span>
                {e.identity && <span className="text-white/40"> · {e.identity}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-white/10">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/40">{children}</p>;
}
