interface Props {
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  leaveLabel: string;
  // Agent-only controls
  onToggleRecording?: () => void;
  recording?: boolean;
  recordingBusy?: boolean;
  onToggleChat?: () => void;
  unreadCount?: number;
}

function PillButton({
  active,
  danger,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const base = 'flex flex-col items-center justify-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium transition';
  const tone = danger
    ? 'bg-red-600 text-white hover:bg-red-500'
    : active
      ? 'bg-white/15 text-white hover:bg-white/25'
      : 'bg-red-500/90 text-white hover:bg-red-500';
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`${base} ${tone}`}>
      {children}
      <span>{label}</span>
    </button>
  );
}

export function Controls({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onLeave,
  leaveLabel,
  onToggleRecording,
  recording,
  recordingBusy,
  onToggleChat,
  unreadCount,
}: Props) {
  return (
    <div className="safe-bottom flex items-center justify-center gap-3 px-4 py-3">
      <PillButton active={micEnabled} onClick={onToggleMic} label={micEnabled ? 'Mute' : 'Unmute'}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          {micEnabled ? (
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />
          ) : (
            <path d="M3.3 2.3 1.9 3.7l6.1 6.1V11a4 4 0 0 0 6 3.5l1.5 1.5A6 6 0 0 1 6 11H4a8 8 0 0 0 3.2 6.4L2 22.7 3.4 24 21.7 5.7 20.3 4.3 3.3 2.3ZM16 11V5a4 4 0 0 0-7.7-1.5L16 11Z" />
          )}
        </svg>
      </PillButton>

      <PillButton active={cameraEnabled} onClick={onToggleCamera} label={cameraEnabled ? 'Stop video' : 'Start video'}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          {cameraEnabled ? (
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
          ) : (
            <path d="M3.3 2.3 1.9 3.7 4 5.8V17a1 1 0 0 0 1 1h12c.2 0 .4 0 .5-.1l2.8 2.8 1.4-1.4L3.3 2.3ZM17 7v3.5l4-4v11l-2-2V7a1 1 0 0 0-1-1H8.2L7 4.8V4h.2L17 7Z" />
          )}
        </svg>
      </PillButton>

      {onToggleChat && (
        <PillButton active onClick={onToggleChat} label="Chat">
          <div className="relative">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1Z" />
            </svg>
            {!!unreadCount && unreadCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
        </PillButton>
      )}

      {onToggleRecording && (
        <PillButton
          active={!recording}
          danger={recording}
          onClick={recordingBusy ? () => {} : onToggleRecording}
          label={recordingBusy ? '...' : recording ? 'Stop rec' : 'Record'}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            {recording ? <rect x="7" y="7" width="10" height="10" rx="2" /> : <circle cx="12" cy="12" r="6" />}
          </svg>
        </PillButton>
      )}

      <PillButton danger onClick={onLeave} label={leaveLabel}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          <path d="M21 15.5c-1.2 0-2.5-.2-3.6-.6a1 1 0 0 0-1 .2l-2.2 2.2a15 15 0 0 1-6.6-6.6l2.2-2.2a1 1 0 0 0 .2-1C9.7 6.5 9.5 5.2 9.5 4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1A17 17 0 0 0 21 21a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1Z" />
        </svg>
      </PillButton>
    </div>
  );
}
