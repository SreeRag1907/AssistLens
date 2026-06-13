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

/** Front/back camera toggle (Google Meet / Material flip_camera_ios style). */
export function CameraFlipIcon({ className = 'h-5 w-5 sm:h-6 sm:w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20 5h-3.17L15 3H9L7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-8 13.5V18H9v-1.5l3-3 3 3V18h-3v-1.5ZM10 6h4v3h-4V6Z" />
    </svg>
  );
}
