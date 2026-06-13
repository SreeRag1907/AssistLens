import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  type RemoteParticipant,
} from 'livekit-client';
import type { DataPayload } from './types';

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface UseRoomOptions {
  url: string;
  token: string;
  onData?: (payload: DataPayload) => void;
  /** Room deleted or server shut down — session is over. */
  onSessionEnded?: () => void;
  initialMicEnabled?: boolean;
  initialCameraEnabled?: boolean;
}

export interface UseRoomResult {
  room: Room | null;
  status: CallStatus;
  error: string | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  tick: number; // bumps whenever participants/tracks change, to drive re-renders
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  sendData: (payload: DataPayload) => void;
  disconnect: () => void;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Plain-language mapping for the (rare) statuses a customer might see.
export function statusLabel(status: CallStatus): string {
  switch (status) {
    case 'connecting':
      return 'Connecting you to the call...';
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Connection dropped — reconnecting...';
    case 'disconnected':
      return 'The call has ended.';
    case 'error':
      return 'We could not connect you to the call.';
    default:
      return '';
  }
}

export function useRoom({
  url,
  token,
  onData,
  onSessionEnded,
  initialMicEnabled = true,
  initialCameraEnabled = true,
}: UseRoomOptions): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [cameraEnabled, setCameraEnabled] = useState(initialCameraEnabled);
  const [tick, setTick] = useState(0);

  const onDataRef = useRef(onData);
  const onSessionEndedRef = useRef(onSessionEnded);
  onDataRef.current = onData;
  onSessionEndedRef.current = onSessionEnded;

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url || !token) return;
    let cancelled = false;
    const r = new Room({ adaptiveStream: true, dynacast: true });

    const onState = (state: ConnectionState) => {
      if (state === ConnectionState.Connected) setStatus('connected');
      else if (state === ConnectionState.Reconnecting) setStatus('reconnecting');
      else if (state === ConnectionState.Connecting) setStatus('connecting');
    };
    const onDisconnected = (reason?: DisconnectReason) => {
      setStatus('disconnected');
      // Only navigate away when the session is truly over — not on network blips
      // or when the user intentionally leaves (handled by the Leave button).
      if (
        reason === DisconnectReason.ROOM_DELETED ||
        reason === DisconnectReason.SERVER_SHUTDOWN
      ) {
        onSessionEndedRef.current?.();
      }
    };
    const onData = (payload: Uint8Array, _p?: RemoteParticipant) => {
      try {
        const parsed = JSON.parse(decoder.decode(payload)) as DataPayload;
        onDataRef.current?.(parsed);
      } catch {
        /* ignore malformed data */
      }
    };

    r.on(RoomEvent.ConnectionStateChanged, onState)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.ParticipantConnected, bump)
      .on(RoomEvent.ParticipantDisconnected, bump)
      .on(RoomEvent.TrackSubscribed, bump)
      .on(RoomEvent.TrackUnsubscribed, bump)
      .on(RoomEvent.TrackMuted, bump)
      .on(RoomEvent.TrackUnmuted, bump)
      .on(RoomEvent.LocalTrackPublished, bump)
      .on(RoomEvent.LocalTrackUnpublished, bump)
      .on(RoomEvent.DataReceived, onData);

    setStatus('connecting');
    (async () => {
      try {
        await r.connect(url, token);
        if (cancelled) {
          await r.disconnect();
          return;
        }
        setRoom(r);
        try {
          await r.localParticipant.setMicrophoneEnabled(initialMicEnabled);
          await r.localParticipant.setCameraEnabled(initialCameraEnabled);
          setMicEnabled(initialMicEnabled);
          setCameraEnabled(initialCameraEnabled);
        } catch {
          setMicEnabled(false);
          setCameraEnabled(false);
          setError('We could not access your camera or microphone. Check your browser permissions.');
        }
        bump();
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Failed to connect.');
        }
      }
    })();

    return () => {
      cancelled = true;
      r.removeAllListeners();
      r.disconnect();
    };
  }, [url, token, bump, initialMicEnabled, initialCameraEnabled]);

  const toggleMic = useCallback(async () => {
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
    bump();
  }, [room, bump]);

  const toggleCamera = useCallback(async () => {
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
    bump();
  }, [room, bump]);

  const sendData = useCallback(
    (payload: DataPayload) => {
      if (!room) return;
      room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), { reliable: true });
    },
    [room],
  );

  const disconnect = useCallback(() => {
    room?.disconnect();
  }, [room]);

  return {
    room,
    status,
    error,
    micEnabled,
    cameraEnabled,
    tick,
    toggleMic,
    toggleCamera,
    sendData,
    disconnect,
  };
}
