import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Participant } from 'livekit-client';
import { useRoom, statusLabel } from '../lib/useRoom';
import { ApiError, getMessages, listFiles, listRecordings, postMessage, uploadFile, downloadFile } from '../lib/api';
import type { ChatFile, ChatMessage, DataPayload, Role } from '../lib/types';
import { ParticipantView } from './ParticipantView';
import { Controls } from './Controls';
import { Chat } from './Chat';

interface Props {
  url: string;
  token: string;
  authToken: string;
  sessionId: string;
  myIdentity: string;
  role: Role;
  initialRecording?: boolean;
  recordingAvailable?: boolean;
  onEndSession?: () => Promise<void>;
  onStartRecording?: () => Promise<{ id: string } | void>;
  onStopRecording?: (recordingId: string | null) => Promise<void>;
  onRejoin?: () => Promise<void>;
  /** User clicked Leave/End, or chose Leave on the disconnect overlay. */
  onLeft: () => void;
  /** Room was closed by the agent — session is over, no rejoin. */
  onSessionEnded?: () => void;
}

function nameFor(p: Participant): string {
  if (p.name) return p.name;
  if (p.identity.startsWith('agent')) return 'Support agent';
  return 'Customer';
}

export function CallStage(props: Props) {
  const { url, token, authToken, sessionId, myIdentity, role } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(!!props.initialRecording);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    props.initialRecording ? Date.now() : null,
  );
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [rejoining, setRejoining] = useState(false);
  const [leftVoluntarily, setLeftVoluntarily] = useState(false);

  const handleData = useCallback((payload: DataPayload) => {
    if (payload.type === 'chat') {
      const incoming: ChatMessage = {
        id: payload.id,
        sender_identity: `${payload.role}-remote`,
        sender_role: payload.role,
        sender_name: payload.name,
        body: payload.body,
        created_at: payload.ts,
      };
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      setChatOpen((open) => {
        if (!open) setUnread((u) => u + 1);
        return open;
      });
    } else if (payload.type === 'recording') {
      const active = payload.status === 'in_progress';
      setRecording(active);
      setRecordingStartedAt(active ? Date.now() : null);
    } else if (payload.type === 'file') {
      setFiles((prev) => (prev.some((f) => f.id === payload.file.id) ? prev : [...prev, payload.file]));
    }
  }, []);

  const room = useRoom({
    url,
    token,
    onData: handleData,
    onSessionEnded: props.onSessionEnded ?? props.onLeft,
  });

  const endRecordingUi = useCallback(
    (notifyCustomer = true) => {
      setRecording(false);
      setRecordingStartedAt(null);
      setRecordingId(null);
      if (notifyCustomer) {
        room.sendData({ type: 'recording', status: 'idle' });
      }
    },
    [room],
  );

  // Keep UI in sync with server — server may fail a recording while the local timer still runs.
  useEffect(() => {
    if (!recording || role !== 'agent' || !recordingId) return;
    const sync = async () => {
      try {
        const res = await listRecordings(authToken, sessionId);
        const rec = res.recordings.find((r) => r.id === recordingId);
        if (!rec) return;
        if (rec.status === 'in_progress') return;
        if (rec.status === 'processing') {
          endRecordingUi(true);
          return;
        }
        if (rec.status === 'failed') {
          setRecordingError('Recording failed on the server. Try starting again.');
          endRecordingUi(true);
        }
      } catch {
        /* ignore */
      }
    };
    const t = setInterval(sync, 4000);
    return () => clearInterval(t);
  }, [recording, recordingId, role, authToken, sessionId, endRecordingUi]);

  useEffect(() => {
    getMessages(authToken, sessionId)
      .then((res) => setMessages(res.messages))
      .catch(() => {});
    listFiles(authToken, sessionId)
      .then((res) => setFiles(res.files))
      .catch(() => {});
  }, [authToken, sessionId]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen, messages.length]);

  useEffect(() => {
    if (!recording || !recordingStartedAt) {
      setRecordingSecs(0);
      return;
    }
    const tick = () => setRecordingSecs(Math.floor((Date.now() - recordingStartedAt) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [recording, recordingStartedAt]);

  const participants: Participant[] = useMemo(() => {
    if (!room.room) return [];
    return [room.room.localParticipant, ...Array.from(room.room.remoteParticipants.values())];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.room, room.tick]);

  const local = participants.find((p) => p.isLocal);
  const remotes = participants.filter((p) => !p.isLocal);

  const handleSend = useCallback(
    async (body: string) => {
      try {
        const res = await postMessage(authToken, sessionId, body);
        const msg = res.message;
        setMessages((prev) => [...prev, msg]);
        room.sendData({
          type: 'chat',
          id: msg.id,
          body: msg.body,
          name: msg.sender_name ?? 'Someone',
          role: msg.sender_role,
          ts: msg.created_at,
        });
      } catch {
        /* keep call resilient */
      }
    },
    [authToken, sessionId, room],
  );

  const toggleRecording = useCallback(async () => {
    setRecordingError(null);
    if (!recording && props.recordingAvailable === false) {
      setRecordingError('Recording is unavailable. Run docker compose up in the project folder.');
      return;
    }
    if (recording && recordingStartedAt && Date.now() - recordingStartedAt < 10_000) {
      setRecordingError('Keep recording for at least 10 seconds so the video can save.');
      return;
    }
    setRecordingBusy(true);
    try {
      if (!recording) {
        const started = await props.onStartRecording?.();
        setRecording(true);
        setRecordingStartedAt(Date.now());
        if (started?.id) setRecordingId(started.id);
        room.sendData({ type: 'recording', status: 'in_progress' });
      } else {
        await props.onStopRecording?.(recordingId);
        endRecordingUi(true);
      }
    } catch (err) {
      setRecordingError(
        err instanceof ApiError ? err.message : 'Could not update recording. Try again.',
      );
      endRecordingUi(true);
    } finally {
      setRecordingBusy(false);
    }
  }, [recording, recordingStartedAt, room, props, endRecordingUi]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const res = await uploadFile(authToken, sessionId, file);
        setFiles((prev) => [...prev, res.file]);
        room.sendData({ type: 'file', file: res.file });
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Upload failed. Is MinIO running?');
      } finally {
        setUploading(false);
      }
    },
    [authToken, sessionId, role, room],
  );

  const handleGetFileUrl = useCallback(
    async (fileId: string): Promise<string> => {
      const file = files.find((f) => f.id === fileId);
      await downloadFile(authToken, sessionId, fileId, file?.file_name ?? 'download');
      return '';
    },
    [authToken, sessionId, files],
  );

  const leave = useCallback(async () => {
    setLeftVoluntarily(true);
    if (role === 'agent') {
      if (recording) {
        endRecordingUi(true);
        if (props.onStopRecording) {
          try {
            await props.onStopRecording(recordingId);
          } catch {
            /* session end also stops recording server-side */
          }
        }
      }
      if (props.onEndSession) {
        await props.onEndSession();
      }
    }
    room.disconnect();
    props.onLeft();
  }, [role, recording, room, props, endRecordingUi]);

  const handleRejoin = useCallback(async () => {
    if (!props.onRejoin) return;
    setRejoining(true);
    try {
      await props.onRejoin();
    } finally {
      setRejoining(false);
    }
  }, [props]);

  const connecting = room.status === 'connecting' || room.status === 'reconnecting';
  const dropped = !leftVoluntarily && (room.status === 'disconnected' || room.status === 'error');
  const showRecord = role === 'agent';

  return (
    <div className="relative grid h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-slate-950 text-white">
      <header className="shrink-0 border-b border-white/10">
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-strong">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.6" />
                <circle cx="12" cy="12" r="3.4" fill="currentColor" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight">AssistLens</span>
          </div>
          <div className="flex items-center gap-2">
            {connecting && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                {statusLabel(room.status)}
              </span>
            )}
            {recording && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                REC {recordingSecs > 0 ? `${Math.floor(recordingSecs / 60)}:${String(recordingSecs % 60).padStart(2, '0')}` : ''}
              </span>
            )}
            {recordingBusy && (
              <span className="text-xs text-amber-300">Starting recording…</span>
            )}
          </div>
        </div>
        {(room.error || recordingError) && !dropped && (
          <div className="space-y-1 border-t border-white/5 px-4 py-2">
            {room.error && room.status !== 'disconnected' && (
              <div className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs text-amber-300 ring-1 ring-amber-500/20">
                {room.error}
              </div>
            )}
            {recordingError && (
              <div className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-300 ring-1 ring-red-500/20">
                {recordingError}
              </div>
            )}
          </div>
        )}
      </header>

      <div className="relative min-h-0 px-3 py-2">
        {recording && role === 'customer' && (
          <div className="mx-auto mb-2 flex max-w-5xl items-center justify-center gap-2 rounded-xl bg-red-600/90 px-4 py-2 text-center text-sm font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            This call is being recorded
          </div>
        )}
        <div className="mx-auto flex h-full max-w-5xl flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border-2 border-white/15 bg-slate-900 shadow-[inset_0_0_60px_rgba(0,0,0,0.35)]">
            {remotes.length > 0 ? (
              <ParticipantView
                participant={remotes[0]}
                isLocal={false}
                label={nameFor(remotes[0])}
                tick={room.tick}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-center">
                <div className="relative mb-5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
                  <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-strong shadow-glow">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="currentColor" aria-hidden>
                      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
                    </svg>
                  </div>
                </div>
                <p className="text-base font-medium text-white/90">
                  {role === 'agent' ? 'Waiting for the customer to join…' : 'Waiting for your agent to join…'}
                </p>
                <p className="mt-1 text-sm text-white/40">You can keep this page open.</p>
              </div>
            )}

            {local && !dropped && (
              <div className="absolute bottom-3 right-3 z-10 h-28 w-24 overflow-hidden sm:h-36 sm:w-28">
                <ParticipantView participant={local} isLocal pip label="You" tick={room.tick} />
              </div>
            )}

            {dropped && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 px-6 text-center backdrop-blur-sm">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-500/20 text-amber-400">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2v2Zm0-4h-2V7h2v5Z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {room.status === 'error' ? 'Could not connect' : 'You were disconnected'}
                </h2>
                <p className="mt-1 max-w-xs text-sm text-white/60">
                  {room.error ?? 'Your connection dropped. You can rejoin if the session is still active.'}
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {props.onRejoin && (
                    <button
                      type="button"
                      onClick={handleRejoin}
                      disabled={rejoining}
                      className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-strong disabled:opacity-60"
                    >
                      {rejoining ? 'Rejoining…' : 'Rejoin call'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={props.onLeft}
                    className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Leave
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!dropped && (
        <footer className="shrink-0 border-t border-white/10 bg-slate-950/95 backdrop-blur-md">
          <Controls
            micEnabled={room.micEnabled}
            cameraEnabled={room.cameraEnabled}
            onToggleMic={room.toggleMic}
            onToggleCamera={room.toggleCamera}
            onLeave={leave}
            leaveLabel={role === 'agent' ? 'End' : 'Leave'}
            onToggleChat={() => setChatOpen((o) => !o)}
            unreadCount={unread}
            onToggleRecording={showRecord ? toggleRecording : undefined}
            recording={recording}
            recordingBusy={recordingBusy}
            recordingSecs={recordingSecs}
            recordingAvailable={props.recordingAvailable !== false}
          />
        </footer>
      )}

      <Chat
        open={chatOpen && !dropped}
        onClose={() => setChatOpen(false)}
        messages={messages}
        files={files}
        myIdentity={myIdentity}
        onSend={handleSend}
        onUpload={handleUpload}
        uploading={uploading}
        onGetFileUrl={handleGetFileUrl}
      />
    </div>
  );
}
