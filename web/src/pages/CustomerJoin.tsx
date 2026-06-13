import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { checkInvite, checkInviteByCode, join, joinByCode, ApiError } from '../lib/api';
import {
  clearCustomerSession,
  loadCustomerSession,
  saveCustomerSession,
} from '../lib/customerSession';
import type { JoinInfo } from '../lib/types';
import { CallStage } from '../components/CallStage';
import { PreJoinLobby, type MediaPrefs } from '../components/PreJoinLobby';
import { Button, Logo, ThemeToggle, Spinner } from '../components/ui';

type Phase = 'checking' | 'invalid' | 'lobby' | 'joining' | 'incall' | 'left' | 'ended';

export function CustomerJoin() {
  const { code: pathCode = '' } = useParams();
  const [params] = useSearchParams();
  const legacyToken = params.get('token') ?? '';
  const inviteCode = pathCode || params.get('code') || '';

  const [phase, setPhase] = useState<Phase>('checking');
  const [sessionTitle, setSessionTitle] = useState('Video support');
  const [invalidReason, setInvalidReason] = useState('');
  const [name, setName] = useState('');
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [mediaPrefs, setMediaPrefs] = useState<MediaPrefs>({ micEnabled: true, cameraEnabled: true });
  const [callKey, setCallKey] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRejoinAttempted = useRef(false);

  const sessionKey = inviteCode || legacyToken.slice(-32);

  useEffect(() => {
    if (!inviteCode && !legacyToken) {
      setPhase('invalid');
      setInvalidReason('This link is missing its invite code.');
      return;
    }

    const saved = sessionKey ? loadCustomerSession(sessionKey) : null;
    if (saved?.name) setName(saved.name);

    const check = inviteCode
      ? checkInviteByCode(inviteCode)
      : checkInvite(legacyToken);

    check
      .then(async (res) => {
        if (!res.valid) {
          if (sessionKey) clearCustomerSession(sessionKey);
          setPhase('invalid');
          setInvalidReason(reasonText(res.reason));
          return;
        }

        setSessionTitle(res.sessionTitle ?? 'Video support');

        if (saved?.wasInCall && !saved.pendingRejoin && !autoRejoinAttempted.current) {
          autoRejoinAttempted.current = true;
          setPhase('joining');
          try {
            const info = inviteCode
              ? await joinByCode(inviteCode, saved.name.trim() || undefined)
              : await join(legacyToken, saved.name.trim() || undefined);
            await enterCall(info, saved.name.trim() || info.displayName, { micEnabled: true, cameraEnabled: true });
            return;
          } catch (err) {
            if (err instanceof ApiError && (err.status === 410 || err.code === 'session_ended')) {
              if (sessionKey) clearCustomerSession(sessionKey);
              setPhase('ended');
              return;
            }
            setPhase('left');
            setError(err instanceof ApiError ? err.message : 'Could not reconnect.');
            return;
          }
        }

        if (saved?.pendingRejoin) {
          setPhase('left');
          return;
        }

        setPhase('lobby');
      })
      .catch((err) => {
        setPhase('invalid');
        setInvalidReason(err instanceof ApiError ? err.message : 'This invite link could not be opened.');
      });
  }, [inviteCode, legacyToken, sessionKey]);

  async function enterCall(info: JoinInfo, displayName: string, prefs: MediaPrefs) {
    setJoinInfo(info);
    setAuthToken(info.inviteToken);
    setMediaPrefs(prefs);
    setDuplicateWarning(info.duplicate);
    setCallKey((k) => k + 1);
    if (sessionKey) {
      saveCustomerSession(sessionKey, {
        name: displayName,
        wasInCall: true,
        pendingRejoin: false,
        sessionId: info.sessionId,
      });
    }
    setPhase('incall');
  }

  async function handleJoinFromLobby(prefs: MediaPrefs) {
    setError(null);
    setPhase('joining');
    try {
      const info = inviteCode
        ? await joinByCode(inviteCode, name.trim() || undefined)
        : await join(legacyToken, name.trim() || undefined);
      await enterCall(info, name.trim() || info.displayName, prefs);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 410 || err.code === 'session_ended')) {
        if (sessionKey) clearCustomerSession(sessionKey);
        setPhase('ended');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'We could not connect you.');
      setPhase('lobby');
    }
  }

  async function handleRejoin() {
    setError(null);
    setPhase('lobby');
  }

  function handleLeft() {
    if (sessionKey) {
      saveCustomerSession(sessionKey, {
        name,
        wasInCall: true,
        pendingRejoin: true,
        sessionId: joinInfo?.sessionId,
      });
    }
    setJoinInfo(null);
    setAuthToken('');
    setPhase('left');
  }

  function handleSessionEnded() {
    if (sessionKey) clearCustomerSession(sessionKey);
    setJoinInfo(null);
    setAuthToken('');
    setPhase('ended');
  }

  if (phase === 'checking' || phase === 'joining') {
    return (
      <Screen subtitle={sessionTitle !== 'Video support' ? sessionTitle : undefined}>
        <div className="flex flex-col items-center justify-center py-16">
        <Spinner className="h-10 w-10" />
        <p className="mt-4 text-sm text-muted">
          {phase === 'joining' ? 'Joining your call…' : 'Opening your support session…'}
        </p>
        </div>
      </Screen>
    );
  }

  if (phase === 'invalid') {
    return (
      <Screen>
        <div className="mx-auto w-full max-w-sm animate-scale-in rounded-xl border border-line bg-surface p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-fg">This link can't be opened</h1>
          <p className="mt-2 text-sm text-muted">{invalidReason}</p>
        </div>
      </Screen>
    );
  }

  if (phase === 'ended') {
    return (
      <Screen subtitle={sessionTitle}>
        <EndSessionCard sessionTitle={sessionTitle} />
      </Screen>
    );
  }

  if (phase === 'left') {
    return (
      <Screen subtitle={sessionTitle}>
        <div className="mx-auto w-full max-w-sm animate-scale-in rounded-xl border border-line bg-surface p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-fg">You've left the call</h1>
          <p className="mt-2 text-sm text-muted">You can rejoin if the session is still active.</p>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          <Button onClick={handleRejoin} className="mt-5 w-full py-3">
            Rejoin call
          </Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'lobby') {
    return (
      <Screen subtitle={sessionTitle}>
        <PreJoinLobby
          sessionTitle={sessionTitle}
          name={name}
          onNameChange={setName}
          busy={false}
          error={error}
          onJoin={handleJoinFromLobby}
        />
      </Screen>
    );
  }

  if (phase === 'incall' && joinInfo && authToken) {
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
          authToken={authToken}
          sessionId={joinInfo.sessionId}
          myIdentity={joinInfo.identity}
          role="customer"
          initialRecording={joinInfo.recording === 'in_progress'}
          initialMicEnabled={mediaPrefs.micEnabled}
          initialCameraEnabled={mediaPrefs.cameraEnabled}
          onRejoin={async () => {
            const info = inviteCode
              ? await joinByCode(inviteCode, name.trim() || undefined)
              : await join(legacyToken, name.trim() || undefined);
            setJoinInfo(info);
            setAuthToken(info.inviteToken);
            setCallKey((k) => k + 1);
          }}
          onLeft={handleLeft}
          onSessionEnded={handleSessionEnded}
        />
      </>
    );
  }

  return null;
}

function reasonText(reason?: string): string {
  if (reason === 'ended') return 'This support session has already ended.';
  if (reason === 'not_found') return "We couldn't find this support session.";
  return 'This invite link is invalid or has expired.';
}

function EndSessionCard({ sessionTitle }: { sessionTitle: string }) {
  const hasTitle = sessionTitle !== 'Video support';
  const [showCloseHelp, setShowCloseHelp] = useState(false);
  const closeShortcut = /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘ + W' : 'Ctrl + W';

  function handleDone() {
    window.close();
    // Invite links open in a normal tab — browsers block programmatic close.
    setShowCloseHelp(true);
  }

  return (
    <div className="mx-auto w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface text-center shadow-card">
      <div className="border-b border-line bg-gradient-to-b from-brand/10 to-transparent px-8 pb-6 pt-10">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand ring-1 ring-brand/20">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Thanks for joining</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {hasTitle ? (
            <>
              Your <span className="font-medium text-fg">{sessionTitle}</span> session has ended.
            </>
          ) : (
            'Your video support session has ended.'
          )}
        </p>
      </div>

      <div className="space-y-5 px-8 py-7 text-left">
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">What to know</p>
          <ul className="mt-3 space-y-3 text-sm text-muted">
            <li className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M9.55 17.55 4 12l1.4-1.4 4.15 4.15 9.05-9.05L20 7.1z" />
                </svg>
              </span>
              <span>Your agent has ended the call — you're safe to leave this page.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M9.55 17.55 4 12l1.4-1.4 4.15 4.15 9.05-9.05L20 7.1z" />
                </svg>
              </span>
              <span>No further action is needed on your side.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M9.55 17.55 4 12l1.4-1.4 4.15 4.15 9.05-9.05L20 7.1z" />
                </svg>
              </span>
              <span>Still need help? Ask your agent to send a new invite link.</span>
            </li>
          </ul>
        </div>

        <Button variant="secondary" onClick={handleDone} className="w-full py-3">
          {showCloseHelp ? 'Done' : 'Done — close this tab'}
        </Button>

        {showCloseHelp ? (
          <div
            role="status"
            className="animate-fade-in rounded-xl border border-brand/30 bg-brand/10 px-4 py-4 text-center"
          >
            <p className="text-sm font-semibold text-fg">Close this browser tab to leave</p>
            <p className="mt-2 text-sm text-muted">
              Press{' '}
              <kbd className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-fg">
                {closeShortcut}
              </kbd>{' '}
              or tap the <span className="font-medium text-fg">×</span> on this tab.
            </p>
          </div>
        ) : (
          <p className="text-center text-xs text-subtle">
            When you're finished, close this browser tab.
          </p>
        )}
      </div>
    </div>
  );
}

function Screen({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="min-h-[100dvh] bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Logo size={28} withWordmark />
          {subtitle && (
            <p className="hidden flex-1 truncate text-center text-xs font-medium text-muted sm:block">{subtitle}</p>
          )}
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
