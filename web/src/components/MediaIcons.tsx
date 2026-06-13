const SLASH = 'M3 3L21 21';

type IconProps = { className?: string };

export function MicIcon({ className = 'h-5 w-5 sm:h-6 sm:w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}

export function MicOffIcon({ className = 'h-5 w-5 sm:h-6 sm:w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />
      <path d={SLASH} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function CameraIcon({ className = 'h-5 w-5 sm:h-6 sm:w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
    </svg>
  );
}

export function CameraOffIcon({ className = 'h-5 w-5 sm:h-6 sm:w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
      <path d={SLASH} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Front/back camera toggle (Material "cameraswitch" style). */
export function CameraFlipIcon({ className = 'h-5 w-5 sm:h-6 sm:w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16 7h3v3h-2V8h-2.5A5.5 5.5 0 0 0 9 13.5V15H7v-1.5A7.5 7.5 0 0 1 16.5 7H16zM8 17H5v-3h2v2h2.5A5.5 5.5 0 0 0 15 10.5V9h2v1.5A7.5 7.5 0 0 1 7.5 17H8z" />
    </svg>
  );
}
