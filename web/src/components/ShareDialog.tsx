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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-scale-in rounded-3xl border border-line bg-surface p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong text-white shadow-glow">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M18 8a3 3 0 1 0-2.8-4H15a3 3 0 0 0 .2 1.1L8.9 8.6a3 3 0 1 0 0 6.8l6.3 3.5A3 3 0 1 0 18 16a3 3 0 0 0-2 .8l-6.1-3.4a3 3 0 0 0 0-2.8L16 7.2A3 3 0 0 0 18 8Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-fg">Share invite link</h2>
              <p className="text-sm text-muted">{title || 'Send this to your customer via SMS or email.'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="m12 10.6 5-5 1.4 1.4-5 5 5 5L17 18.4l-5-5-5 5L5.6 17l5-5-5-5L7 5.6l5 5Z" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
              Generating link…
            </div>
          ) : error ? (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500 ring-1 ring-red-500/20">{error}</p>
          ) : (
            <>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                Invite link
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url ?? ''}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none"
                />
                <Button variant="secondary" onClick={copy} className="shrink-0">
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {canNativeShare && (
                  <Button onClick={nativeShare} className="w-full">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d="M12 3l4 4h-3v7h-2V7H8l4-4Zm-7 9h2v7h10v-7h2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z" />
                    </svg>
                    Share…
                  </Button>
                )}
                <a
                  href={`sms:?&body=${encodeURIComponent(`Join your video support call: ${url ?? ''}`)}`}
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full">
                    Send via SMS
                  </Button>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent('Your video support call')}&body=${encodeURIComponent(
                    `Join your video support call: ${url ?? ''}`,
                  )}`}
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full">
                    Send via email
                  </Button>
                </a>
              </div>

              <p className="mt-4 text-xs text-subtle">
                Anyone with this link can join as the customer. It expires automatically.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
