import { useEffect, useState } from 'react';
import { Button } from './ui';

interface Props {
  open: boolean;
  url: string | null;
  title?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export function ShareDialog({ open, url, title, loading, error, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  async function nativeShare() {
    if (!url) return;
    try {
      await navigator.share({
        title: 'AssistLens video support',
        text: 'Join your video support call:',
        url,
      });
    } catch {
      /* user dismissed */
    }
  }

  function gmailComposeHref(): string {
    if (!url) return '#';
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      su: 'Your video support call',
      body: `Join your video support call:\n\n${url}`,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-scale-in rounded-xl border border-line bg-surface p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-fg">Share invite link</h2>
            <p className="mt-1 text-sm text-muted">{title || 'Send this link to your customer.'}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="m12 10.6 5-5 1.4 1.4-5 5 5 5L17 18.4l-5-5-5 5L5.6 17l5-5-5-5L7 5.6l5 5Z" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
              Generating link…
            </div>
          ) : error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : (
            <>
              <label className="label">Invite URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url ?? ''}
                  onFocus={(e) => e.currentTarget.select()}
                  className="field min-w-0 flex-1 font-mono text-xs"
                />
                <Button variant="secondary" onClick={copy} className="shrink-0">
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {canNativeShare && (
                  <Button onClick={nativeShare} className="w-full">
                    Share…
                  </Button>
                )}
                <a
                  href={`sms:?&body=${encodeURIComponent(`Join your video support call: ${url ?? ''}`)}`}
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full">SMS</Button>
                </a>
                <a
                  href={gmailComposeHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full">Email</Button>
                </a>
              </div>

              <p className="mt-4 text-xs text-subtle">
                Anyone with this link can join as the customer. The link expires when the session ends.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
