import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  endSession,
  getAgentToken,
  getAgentToken_,
  getRecordingStatus,
  startRecording,
  stopRecording,
  ApiError,
} from '../lib/api';
import type { AgentTokenInfo } from '../lib/types';
import { useAuthVersion } from '../lib/auth';
import { CallStage } from '../components/CallStage';
import { btnClass } from '../components/ui';

export function AgentCall() {
  useAuthVersion();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const token = getAgentToken();
  const [info, setInfo] = useState<AgentTokenInfo | null>(null);
  const [callKey, setCallKey] = useState(0);
  const [recId, setRecId] = useState<string | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTokens = useCallback(async () => {
    if (!token) return;
    const res = await getAgentToken_(token, id);
    setInfo(res);
    setRecordingAvailable(res.recordingAvailable ?? false);
    setRecId(res.activeRecording?.id ?? null);
    setCallKey((k) => k + 1);
  }, [token, id]);

  useEffect(() => {
    if (!token) return;
    refreshTokens().catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Could not join the call.');
    });
  }, [token, id, refreshTokens]);

  // Re-check Egress while in call (Docker may start after join; don't remount CallStage).
  useEffect(() => {
    if (!token) return;
    const check = () => {
      getRecordingStatus(token)
        .then((res) => setRecordingAvailable(res.available))
        .catch(() => setRecordingAvailable(false));
    };
    check();
    const t = setInterval(check, 10_000);
    return () => clearInterval(t);
  }, [token]);

  const handleRejoin = useCallback(async () => {
    if (!token) return;
    await refreshTokens();
  }, [token, refreshTokens]);

  if (error) {
    return (
      <Centered>
        <p className="text-lg text-white">{error}</p>
        <button onClick={() => navigate('/agent')} className={btnClass('primary', 'mt-4')}>
          Back to console
        </button>
      </Centered>
    );
  }

  if (!info || !token) {
    return (
      <Centered>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-brand" />
        <p className="mt-4 text-sm text-white/60">Connecting to the call…</p>
      </Centered>
    );
  }

  return (
    <CallStage
      key={callKey}
      url={info.url}
      token={info.token}
      authToken={token}
      sessionId={id}
      myIdentity={info.identity}
      role="agent"
      initialRecording={!!recId}
      recordingAvailable={recordingAvailable}
      onRejoin={handleRejoin}
      onEndSession={async () => {
        await endSession(token, id);
      }}
      onStartRecording={async () => {
        const res = await startRecording(token, id);
        setRecId(res.recording.id);
        return { id: res.recording.id };
      }}
      onStopRecording={async (recordingId) => {
        await stopRecording(token, id, recordingId ?? recId ?? undefined);
        setRecId(null);
      }}
      onLeft={() => navigate(`/agent/history/${id}`)}
      onSessionEnded={() => navigate(`/agent/history/${id}`)}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 text-center">{children}</div>
  );
}
