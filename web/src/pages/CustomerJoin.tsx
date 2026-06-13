import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkInvite, join, ApiError } from '../lib/api';
import type { JoinInfo } from '../lib/types';
import { CallStage } from '../components/CallStage';

type Phase = 'checking' | 'invalid' | 'welcome' | 'joining' | 'incall' | 'left';

export function CustomerJoin() {
  const [params] = useSearchParams();
  const inviteToken = params.get('token') ?? '';

  const [phase, setPhase] = useState<Phase>('checking');
  const [sessionTitle, setSessionTitle] = useState('Video support');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [name, setName] = useState('');
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      setPhase('invalid');
      setInvalidReason('This link is missing its invite code.');
      return;
    }
    checkInvite(inviteToken)
      .then((res) => {
        if (res.valid) {
          setSessionTitle(res.sessionTitle ?? 'Video support');
          setPhase('welcome');
        } else {
          setPhase('invalid');
          setInvalidReason(reasonText(res.reason));
        }
      })
      .catch((err) => {
        setPhase('invalid');
        setInvalidReason(err instanceof ApiError ? err.message : 'This invite link could not be opened.');
      });
  }, [inviteToken]);

  async function handleJoin() {
    setError(null);
    setPhase('joining');
    try {
      const info = await join(inviteToken, name.trim() || undefined);
      setJoinInfo(info);
      setDuplicateWarning(info.duplicate);
      setPhase('incall');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not connect you.');
      setPhase('welcome');
    }
  }

  if (phase === 'checking') {
    return (
      <Screen>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-brand-500" />
        <p className="mt-4 text-white/70">Opening your support session...</p>
      </Screen>
    );
  }

  if (phase === 'invalid') {
    return (
      <Screen>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-white">This link can’t be opened</h1>
        <p className="mt-2 max-w-xs text-white/60">{invalidReason}</p>
        <p className="mt-4 text-sm text-white/40">Please ask your support agent to send you a new link.</p>
      </Screen>
    );
  }

  if (phase === 'left') {
    return (
      <Screen>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-600/30">
          <span className="text-3xl">👋</span>
        </div>
        <h1 className="text-xl font-bold text-white">You’ve left the call</h1>
        <p className="mt-2 text-white/60">Thanks for using AssistLens support.</p>
      </Screen>
    );
  }

  if (phase === 'incall' && joinInfo) {
    return (
      <>
        {duplicateWarning && (
          <div className="bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-black">
            It looks like you’re already in this call on another tab or device.
          </div>
        )}
        <CallStage
          url={joinInfo.url}
          token={joinInfo.token}
          authToken={inviteToken}
          sessionId={joinInfo.sessionId}
          myIdentity={joinInfo.identity}
          role="customer"
          initialRecording={joinInfo.recording === 'in_progress'}
          onLeft={() => setPhase('left')}
        />
      </>
    );
  }

  // welcome / joining
  return (
    <Screen>
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-7 text-center ring-1 ring-white/10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="currentColor" aria-hidden>
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">Join your video support call</h1>
        <p className="mt-1 text-sm text-white/60">{sessionTitle}</p>

        <div className="mt-5 rounded-xl bg-white/5 p-4 text-left text-sm text-white/70">
          <p className="font-medium text-white/90">Before you join:</p>
          <ul className="mt-2 space-y-1.5">
            <li>• Your browser will ask to use your camera and microphone — tap <b>Allow</b>.</li>
            <li>• This lets the agent see and hear the issue you need help with.</li>
            <li>• No app or account needed. Nothing is installed.</li>
          </ul>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="mt-4 w-full rounded-xl bg-white/5 px-4 py-3 text-center text-white outline-none ring-1 ring-white/10 focus:ring-brand-500"
        />

        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={phase === 'joining'}
          className="mt-4 w-full rounded-xl bg-brand-600 py-3.5 text-lg font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
        >
          {phase === 'joining' ? 'Connecting...' : 'Join video call'}
        </button>
        <p className="mt-3 text-xs text-white/40">You may be recorded for support quality.</p>
      </div>
    </Screen>
  );
}

function reasonText(reason?: string): string {
  if (reason === 'ended') return 'This support session has already ended.';
  if (reason === 'not_found') return 'We couldn’t find this support session.';
  return 'This invite link is invalid or has expired.';
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-4 text-center">
      {children}
    </div>
  );
}
