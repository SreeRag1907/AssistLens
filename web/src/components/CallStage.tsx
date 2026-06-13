import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Participant } from 'livekit-client';
import { useRoom, statusLabel } from '../lib/useRoom';
import { getMessages, postMessage } from '../lib/api';
import type { ChatMessage, DataPayload, Role } from '../lib/types';
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
  onEndSession?: () => Promise<void>;
  onStartRecording?: () => Promise<void>;
  onStopRecording?: () => Promise<void>;
  onLeft: () => void;
}

function nameFor(p: Participant): string {
  if (p.name) return p.name;
  if (p.identity.startsWith('agent')) return 'Support agent';
  return 'Customer';
}

export function CallStage(props: Props) {
  const { url, token, authToken, sessionId, myIdentity, role } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recording, setRecording] = useState(!!props.initialRecording);
  const [recordingBusy, setRecordingBusy] = useState(false);

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
      setRecording(payload.status === 'in_progress');
    }
  }, []);

  const room = useRoom({ url, token, onData: handleData, onEnded: props.onLeft });

  // Load persisted chat history when the call opens.
  useEffect(() => {
    getMessages(authToken, sessionId)
      .then((res) => setMessages(res.messages))
      .catch(() => {});
  }, [authToken, sessionId]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen, messages.length]);

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
        /* surfaced via UI elsewhere; keep call resilient */
      }
    },
    [authToken, sessionId, room],
  );

  const toggleRecording = useCallback(async () => {
    setRecordingBusy(true);
    try {
      if (!recording) {
        await props.onStartRecording?.();
        setRecording(true);
        room.sendData({ type: 'recording', status: 'in_progress' });
      } else {
        await props.onStopRecording?.();
        setRecording(false);
        room.sendData({ type: 'recording', status: 'idle' });
      }
    } catch {
      /* ignore — button re-enables */
    } finally {
      setRecordingBusy(false);
    }
  }, [recording, room, props]);

  const leave = useCallback(async () => {
    if (role === 'agent' && props.onEndSession) {
      await props.onEndSession();
    }
    room.disconnect();
    props.onLeft();
  }, [role, room, props]);

  const connecting = room.status === 'connecting' || room.status === 'reconnecting';

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950">
      {/* Status / recording banner */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          {recording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              This call is being recorded
            </span>
          )}
          {connecting && <span className="text-white/70">{statusLabel(room.status)}</span>}
        </div>
        {room.error && <span className="truncate text-amber-300">{room.error}</span>}
      </div>

      {/* Video area */}
      <div className="relative flex-1 px-2 pb-2">
        <div className="relative h-full w-full">
          {remotes.length > 0 ? (
            <ParticipantView
              participant={remotes[0]}
              isLocal={false}
              label={nameFor(remotes[0])}
              tick={room.tick}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-slate-900 text-center ring-1 ring-white/10">
              <div className="mb-3 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-brand-500" />
              <p className="text-white/80">
                {role === 'agent' ? 'Waiting for the customer to join...' : 'Waiting for your agent to join...'}
              </p>
              <p className="mt-1 text-sm text-white/40">You can keep this page open.</p>
            </div>
          )}

          {/* Local picture-in-picture */}
          {local && (
            <div className="absolute bottom-3 right-3 h-32 w-24 sm:h-40 sm:w-32">
              <ParticipantView participant={local} isLocal label="You" tick={room.tick} />
            </div>
          )}
        </div>
      </div>

      <Controls
        micEnabled={room.micEnabled}
        cameraEnabled={room.cameraEnabled}
        onToggleMic={room.toggleMic}
        onToggleCamera={room.toggleCamera}
        onLeave={leave}
        leaveLabel={role === 'agent' ? 'End' : 'Leave'}
        onToggleChat={() => setChatOpen((o) => !o)}
        unreadCount={unread}
        onToggleRecording={role === 'agent' ? toggleRecording : undefined}
        recording={recording}
        recordingBusy={recordingBusy}
      />

      <Chat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        myIdentity={myIdentity}
        onSend={handleSend}
      />
    </div>
  );
}
