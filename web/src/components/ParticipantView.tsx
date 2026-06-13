import { useEffect, useRef } from 'react';
import { Track, type Participant } from 'livekit-client';

interface Props {
  participant: Participant;
  isLocal: boolean;
  label: string;
  tick: number;
  /** Smaller self-view tile with rounded corners; main stage fills the frame. */
  pip?: boolean;
}

export function ParticipantView({ participant, isLocal, label, tick, pip = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const pub = participant.getTrackPublication(Track.Source.Camera);
    const el = videoRef.current;
    if (el && pub?.track) pub.track.attach(el);
    return () => {
      if (el && pub?.track) pub.track.detach(el);
    };
  }, [participant, tick]);

  useEffect(() => {
    if (isLocal) return; // never play your own mic — avoids echo
    const pub = participant.getTrackPublication(Track.Source.Microphone);
    const el = audioRef.current;
    if (el && pub?.track) pub.track.attach(el);
    return () => {
      if (el && pub?.track) pub.track.detach(el);
    };
  }, [participant, tick, isLocal]);

  const cameraOn = participant.isCameraEnabled;
  const micOn = participant.isMicrophoneEnabled;
  const initial = label.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-slate-800 ${
        pip ? 'rounded-xl ring-2 ring-white/20 shadow-pop' : ''
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${cameraOn ? '' : 'hidden'} ${isLocal ? 'scale-x-[-1]' : ''}`}
      />
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {!cameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div
            className={`flex items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-strong font-semibold text-white shadow-glow ${
              isLocal ? 'h-12 w-12 text-lg' : 'h-24 w-24 text-4xl'
            }`}
          >
            {initial}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur">
        {!micOn && (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-red-400" fill="currentColor" aria-hidden>
            <path d="M3.3 2.3 1.9 3.7l6.1 6.1V11a4 4 0 0 0 6 3.5l1.5 1.5A6 6 0 0 1 6 11H4a8 8 0 0 0 3.2 6.4L2 22.7 3.4 24 21.7 5.7 20.3 4.3 3.3 2.3ZM16 11V5a4 4 0 0 0-7.7-1.5L16 11Z" />
          </svg>
        )}
        <span className="font-medium">{isLocal ? 'You' : label}</span>
      </div>
    </div>
  );
}
