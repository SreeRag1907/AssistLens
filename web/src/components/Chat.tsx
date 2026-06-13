import { useEffect, useRef, useState } from 'react';
import type { ChatFile, ChatMessage } from '../lib/types';

const ALLOWED_EXT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0 opacity-70" fill="currentColor" aria-hidden>
      {isImage ? (
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm2 0v6.586l3.293-3.293 4 4 2-2 3 3V7H5Zm5.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
      ) : isPdf ? (
        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm0 2h7v5h5v11H6V4Zm4.5 7c-.83 0-1.5.67-1.5 1.5v4h1v-1.5h1v1.5h1v-4c0-.83-.67-1.5-1.5-1.5Zm0 1h.01c.27 0 .49.22.49.5V15h-1v-2.5c0-.28.22-.5.5-.5Z" />
      ) : (
        <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 1.5L18.5 8H13V3.5ZM6 4h6v5h5v11H6V4Z" />
      )}
    </svg>
  );
}

type ChatItem =
  | { kind: 'msg'; data: ChatMessage }
  | { kind: 'file'; data: ChatFile };

function buildTimeline(messages: ChatMessage[], files: ChatFile[]): ChatItem[] {
  const items: ChatItem[] = [
    ...messages.map((m) => ({ kind: 'msg' as const, data: m })),
    ...files.map((f) => ({ kind: 'file' as const, data: f })),
  ];
  return items.sort(
    (a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime(),
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  files: ChatFile[];
  myIdentity: string;
  onSend: (body: string) => void;
  onUpload?: (file: File) => Promise<void>;
  uploading?: boolean;
  onGetFileUrl?: (fileId: string) => Promise<string>;
}

export function Chat({
  open,
  onClose,
  messages,
  files,
  myIdentity,
  onSend,
  onUpload,
  uploading = false,
  onGetFileUrl,
}: Props) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timeline = buildTimeline(messages, files);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    onUpload(file).catch(() => {});
    e.target.value = '';
  }

  async function downloadFile(fileId: string) {
    if (!onGetFileUrl) return;
    try {
      await onGetFileUrl(fileId);
    } catch {
      /* handled by caller */
    }
  }

  function senderLabel(identity: string, name: string | null | undefined, role: string) {
    if (identity === myIdentity) return 'You';
    return name ?? (role === 'agent' ? 'Agent' : 'Customer');
  }

  return (
    <div
      className={`absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-white/10 bg-slate-900/95 text-white shadow-pop backdrop-blur-xl transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
        <h2 className="text-sm font-semibold">In-call chat</h2>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="m12 10.6 5-5 1.4 1.4-5 5 5 5L17 18.4l-5-5-5 5L5.6 17l5-5-5-5L7 5.6l5 5Z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {timeline.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center text-white/40">
            <svg viewBox="0 0 24 24" className="mb-2 h-10 w-10 opacity-50" fill="currentColor" aria-hidden>
              <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1Z" />
            </svg>
            <p className="text-sm">No messages yet. Say hello 👋</p>
          </div>
        )}

        {timeline.map((item) => {
          if (item.kind === 'msg') {
            const m = item.data as ChatMessage;
            const mine = m.sender_identity === myIdentity;
            return (
              <div key={`msg-${m.id}`} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="mb-1 px-1 text-[11px] text-white/40">
                  {senderLabel(m.sender_identity, m.sender_name, m.sender_role)}
                </span>
                <div
                  className={`max-w-[82%] px-3.5 py-2 text-sm ${
                    mine
                      ? 'rounded-xl rounded-br-sm bg-brand text-brand-fg'
                      : 'rounded-xl rounded-bl-sm bg-white/10 text-white'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          }

          // File attachment bubble
          const f = item.data as ChatFile;
          const mine = f.sender_identity === myIdentity;
          return (
            <div key={`file-${f.id}`} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 px-1 text-[11px] text-white/40">
                {mine ? 'You' : f.sender_name ?? 'Participant'}
              </span>
              <button
                onClick={() => downloadFile(f.id)}
                className={`flex max-w-[82%] items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm transition hover:opacity-80 active:scale-[0.98] ${
                  mine
                    ? 'rounded-br-sm bg-brand text-brand-fg'
                    : 'rounded-bl-sm bg-white/10 text-white'
                }`}
              >
                <FileIcon mime={f.content_type} />
                <div className="min-w-0 flex-1">
                  <p className="break-all font-medium leading-tight" title={f.file_name}>
                    {f.file_name}
                  </p>
                  <p className="text-[11px] opacity-60">{formatBytes(f.file_size)}</p>
                </div>
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-60" fill="currentColor">
                  <path d="M12 16l-4-4h3V4h2v8h3l-4 4Zm-6 2h12v2H6v-2Z" />
                </svg>
              </button>
            </div>
          );
        })}

        {uploading && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
            Uploading file…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="safe-bottom flex items-center gap-2 border-t border-white/10 px-3 py-3">
        {onUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXT}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              disabled={uploading}
              title="Share a file"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M16.5 6.5v10a4.5 4.5 0 0 1-9 0V5a3 3 0 0 1 6 0v9.5a1.5 1.5 0 0 1-3 0V7h-2v7.5a3.5 3.5 0 0 0 7 0V5a5 5 0 0 0-10 0v11.5a6.5 6.5 0 0 0 13 0V6.5h-2Z" />
              </svg>
            </button>
          </>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none transition focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-strong active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M3.4 2.6 21 12 3.4 21.4 6 12 3.4 2.6Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
