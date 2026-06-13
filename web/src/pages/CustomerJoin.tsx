import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkInvite, join, ApiError } from '../lib/api';
import type { JoinInfo } from '../lib/types';
import { CallStage } from '../components/CallStage';
import { Button, Logo, ThemeToggle } from '../components/ui';

type Phase = 'checking' | 'invalid' | 'welcome' | 'joining' | 'incall' | 'left';

export function CustomerJoin() {
  const [params] = useSearchParams();
  const inviteToken = params.get('token') ?? '';

  const [phase, setPhase] = useState<Phase>('checking');
  const [sessionTitle, setSessionTitle] = useState('Video support');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [name, setName] = useState('');
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
  const [callKey, setCallKey] = useState(0);
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
      setCallKey((k) => k + 1);
      setPhase('incall');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not connect you.');
      setPhase('welcome');
    }
  }

  async function handleRejoin() {
    setError(null);
    const info = await join(inviteToken, name.trim() || undefined);
    setJoinInfo(info);
    setCallKey((k) => k + 1);
    setPhase('incall');
  }

  if (phase === 'checking') {
    return (
      <Screen>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-brand" />
        <p className="mt-4 text-muted">Opening your support session…</p>
      </Screen>
    );
  }

  if (phase === 'invalid') {
    return (
      <Screen>
        <div className="w-full max-w-sm animate-scale-in rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
              <path d="M12 2 1 21h22L12 2Zm0 6 .9 7h-1.8L12 8Zm0 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-fg">This link can't be opened</h1>
          <p className="mt-2 text-sm text-muted">{invalidReason}</p>
          <p className="mt-4 text-xs text-subtle">Please ask your support agent to send you a new link.</p>
        </div>
      </Screen>
    );
  }

  if (phase === 'left') {
    return (
      <Screen>
        <div className="w-full max-w-sm animate-scale-in rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-3xl">
            👋
          </div>
          <h1 className="text-xl font-bold text-fg">You've left the call</h1>
          <p className="mt-2 text-sm text-muted">Need more help? You can rejoin if the session is still active.</p>
          {error && (
            <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
              {error}
            </p>
          )}
          <Button onClick={handleJoin} className="mt-5 w-full py-3">
            Rejoin call
          </Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'incall' && joinInfo) {
    return (
      <>
        {duplicateWarning && (
          <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
            It looks like you're already in this call on another tab or device.
          </div>
        )}
        <CallStage
          key={callKey}
          url={joinInfo.url}
          token={joinInfo.token}
          authToken={inviteToken}
          sessionId={joinInfo.sessionId}
          myIdentity={joinInfo.identity}
          role="customer"
          initialRecording={joinInfo.recording === 'in_progress'}
          onRejoin={handleRejoin}
          onLeft={() => setPhase('left')}
        />
      </>
    );
  }

  // welcome / joining
  return (
    <Screen>
      <div className="w-full max-w-sm animate-fade-in rounded-3xl border border-line bg-surface p-7 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-white shadow-glow">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor" aria-hidden>
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-fg">Join your video support call</h1>
        <p className="mt-1 text-sm text-muted">{sessionTitle}</p>

        <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-4 text-left text-sm text-muted">
          <p className="font-semibold text-fg">Before you join</p>
          <ul className="mt-2.5 space-y-2">
            <li className="flex gap-2.5">
              <Check />
              <span>Your browser will ask for camera &amp; microphone — tap <b className="text-fg">Allow</b>.</span>
            </li>
            <li className="flex gap-2.5">
              <Check />
              <span>This lets the agent see and hear the issue you need help with.</span>
            </li>
            <li className="flex gap-2.5">
              <Check />
              <span>No app or account needed. Nothing is installed.</span>
            </li>
          </ul>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="mt-4 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-fg placeholder:text-subtle outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />

        {error && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        <Button onClick={handleJoin} disabled={phase === 'joining'} className="mt-4 w-full py-4 text-base">
          {phase === 'joining' ? 'Connecting…' : 'Join video call'}
        </Button>
        <p className="mt-3 text-xs text-subtle">You may be recorded for support quality.</p>
      </div>
    </Screen>
  );
}

function Check() {
  return (
    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M9.55 17.55 4 12l1.4-1.4 4.15 4.15 9.05-9.05L20 7.1z" />
      </svg>
    </span>
  );
}

function reasonText(reason?: string): string {
  if (reason === 'ended') return 'This support session has already ended.';
  if (reason === 'not_found') return "We couldn't find this support session.";
  return 'This invite link is invalid or has expired.';
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="absolute left-4 top-4">
        <Logo size={32} withWordmark />
      </div>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
