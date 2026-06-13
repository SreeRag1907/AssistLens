interface Props {
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  leaveLabel: string;
  onToggleRecording?: () => void;
  recording?: boolean;
  recordingBusy?: boolean;
  onToggleChat?: () => void;
  unreadCount?: number;
}

function IconButton({
  onClick,
  label,
  active,
  danger,
  recording,
  badge,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
  recording?: boolean;
  badge?: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  let cls =
    'relative flex h-12 w-full max-w-[3.25rem] items-center justify-center rounded-xl transition active:scale-95 sm:h-14 sm:max-w-[3.5rem]';
  if (danger) cls += ' bg-red-600 text-white hover:bg-red-500';
  else if (recording) cls += ' bg-red-600 text-white ring-2 ring-red-400/40';
  else if (active) cls += ' bg-white/15 text-white hover:bg-white/25';
  else cls += ' bg-slate-700/90 text-white/90 hover:bg-slate-600 ring-1 ring-white/10';
  if (disabled) cls += ' opacity-40 pointer-events-none';

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
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
  const count = 3 + (onToggleChat ? 1 : 0) + (onToggleRecording ? 1 : 0) + 1;

  return (
    <div className="safe-bottom w-full px-2 py-2 sm:px-4 sm:py-3">
      <div
        className="mx-auto grid w-full max-w-md justify-items-center gap-1.5 sm:max-w-lg sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        <IconButton onClick={onToggleMic} label={micEnabled ? 'Mute microphone' : 'Unmute microphone'} active={micEnabled}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
            {micEnabled ? (
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />
            ) : (
              <path d="M3.3 2.3 1.9 3.7l6.1 6.1V11a4 4 0 0 0 6 3.5l1.5 1.5A6 6 0 0 1 6 11H4a8 8 0 0 0 3.2 6.4L2 22.7 3.4 24 21.7 5.7 20.3 4.3 3.3 2.3ZM16 11V5a4 4 0 0 0-7.7-1.5L16 11Z" />
            )}
          </svg>
        </IconButton>

        <IconButton
          onClick={onToggleCamera}
          label={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          active={cameraEnabled}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
            {cameraEnabled ? (
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
            ) : (
              <path d="M3.3 2.3 1.9 3.7 4 5.8V17a1 1 0 0 0 1 1h12c.2 0 .4 0 .5-.1l2.8 2.8 1.4-1.4L3.3 2.3ZM17 7v3.5l4-4v11l-2-2V7a1 1 0 0 0-1-1H8.2L7 4.8V4h.2L17 7Z" />
            )}
          </svg>
        </IconButton>

        {onToggleChat && (
          <IconButton onClick={onToggleChat} label="Open chat" active badge={unreadCount}>
            <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
              <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1Z" />
            </svg>
          </IconButton>
        )}

        {onToggleRecording && (
          <IconButton
            onClick={recordingBusy ? () => {} : onToggleRecording}
            label={recording ? 'Stop recording' : 'Start recording'}
            recording={recording}
            disabled={recordingBusy}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
              {recording ? <rect x="7" y="7" width="10" height="10" rx="2" /> : <circle cx="12" cy="12" r="6" />}
            </svg>
          </IconButton>
        )}

        <IconButton onClick={onLeave} label={leaveLabel} danger>
          <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" aria-hidden>
            <path d="M21 15.5c-1.2 0-2.5-.2-3.6-.6a1 1 0 0 0-1 .2l-2.2 2.2a15 15 0 0 1-6.6-6.6l2.2-2.2a1 1 0 0 0 .2-1C9.7 6.5 9.5 5.2 9.5 4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1A17 17 0 0 0 21 21a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1Z" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
