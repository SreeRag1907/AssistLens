import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  endSession,
  getAgentToken,
  getAgentToken_,
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
  const [recId, setRecId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    (async () => {
      try {
        const res = await getAgentToken_(token, id);
        setInfo(res);
        // Detect an in-progress recording so the indicator survives a refresh.
        const detail = await getSession(token, id);
        const active = detail.recordings.find((r) => r.status === 'in_progress');
        if (active) setRecId(active.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not join the call.');
      }
    })();
  }, [token, id, navigate]);

  if (error) {
    return (
      <Centered>
        <p className="text-lg text-white">{error}</p>
        <button onClick={() => navigate('/agent')} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 font-semibold">
          Back to console
        </button>
      </Centered>
    );
  }

  if (!info || !token) {
    return (
      <Centered>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-brand-500" />
      </Centered>
    );
  }

  return (
    <CallStage
      url={info.url}
      token={info.token}
      authToken={token}
      sessionId={id}
      myIdentity={info.identity}
      role="agent"
      initialRecording={!!recId}
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
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950">{children}</div>;
}
