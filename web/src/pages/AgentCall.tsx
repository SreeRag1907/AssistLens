import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  endSession,
  getAgentToken,
  getAgentToken_,
  getRecordingStatus,
  getSession,
  startRecording,
  stopRecording,
  ApiError,
} from '../lib/api';
import type { AgentTokenInfo } from '../lib/types';
import { CallStage } from '../components/CallStage';

export function AgentCall() {
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
    const [res, detail, recStatus] = await Promise.all([
      getAgentToken_(token, id),
      getSession(token, id),
      getRecordingStatus(token).catch(() => ({ available: false })),
    ]);
    setInfo(res);
    setRecordingAvailable(recStatus.available);
    const active = detail.recordings.find((r) => r.status === 'in_progress');
    setRecId(active ? active.id : null);
    setCallKey((k) => k + 1);
  }, [token, id]);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    refreshTokens().catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Could not join the call.');
    });
  }, [token, id, navigate, refreshTokens]);

  const handleRejoin = useCallback(async () => {
    if (!token) return;
    await refreshTokens();
  }, [token, refreshTokens]);

  if (error) {
    return (
      <Centered>
        <p className="text-lg text-white">{error}</p>
        <button
          onClick={() => navigate('/agent')}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white shadow-glow transition hover:bg-brand-strong"
        >
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
      }}
      onStopRecording={async () => {
        await stopRecording(token, id);
        setRecId(null);
      }}
      onLeft={() => navigate(`/agent/history/${id}`)}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 text-center">{children}</div>
  );
}
