import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  myIdentity: string;
  onSend: (body: string) => void;
}

export function Chat({ open, onClose, messages, myIdentity, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft('');
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
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center text-center text-white/40">
            <svg viewBox="0 0 24 24" className="mb-2 h-10 w-10 opacity-50" fill="currentColor" aria-hidden>
              <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1Z" />
            </svg>
            <p className="text-sm">No messages yet. Say hello 👋</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_identity === myIdentity;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 px-1 text-[11px] text-white/40">
                {mine ? 'You' : m.sender_name ?? (m.sender_role === 'agent' ? 'Agent' : 'Customer')}
              </span>
              <div
                className={`max-w-[82%] px-3.5 py-2 text-sm shadow-sm ${
                  mine
                    ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-brand to-brand-strong text-white'
                    : 'rounded-2xl rounded-bl-md bg-white/10 text-white'
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="safe-bottom flex items-center gap-2 border-t border-white/10 px-3 py-3">
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
            <path d="m3 3 18 9-18 9 4-9-4-9Zm4.5 9H12" stroke="currentColor" strokeWidth="0" />
            <path d="M3.4 2.6 21 12 3.4 21.4 6 12 3.4 2.6Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
