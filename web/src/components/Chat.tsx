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
      className={`absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col bg-slate-900/95 backdrop-blur transition-transform duration-200 sm:border-l sm:border-white/10 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold">Messages</h2>
        <button onClick={onClose} aria-label="Close chat" className="rounded-lg p-1 text-white/70 hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="m12 10.6 5-5 1.4 1.4-5 5 5 5L17 18.4l-5-5-5 5L5.6 17l5-5-5-5L7 5.6l5 5Z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-white/40">No messages yet. Say hello.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_identity === myIdentity;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="mb-0.5 text-[11px] text-white/40">
                {mine ? 'You' : m.sender_name ?? (m.sender_role === 'agent' ? 'Agent' : 'Customer')}
              </span>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? 'bg-brand-600 text-white' : 'bg-white/10 text-white'
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
          placeholder="Type a message"
          className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Send
        </button>
      </form>
    </div>
  );
}
