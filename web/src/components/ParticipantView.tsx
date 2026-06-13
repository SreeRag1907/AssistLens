import { useEffect, useRef } from 'react';
import { Track, type Participant } from 'livekit-client';
import { MicOffIcon } from './MediaIcons';

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
        className={`h-full w-full object-contain bg-black ${cameraOn ? '' : 'hidden'} ${isLocal ? 'scale-x-[-1]' : ''}`}
      />
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {!cameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141416]">
          <div
            className={`flex items-center justify-center rounded-full bg-brand font-bold text-brand-fg ${
              isLocal ? 'h-12 w-12 text-lg' : 'h-24 w-24 text-4xl'
            }`}
          >
            {initial}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur">
        {!micOn && <MicOffIcon className="h-3.5 w-3.5 text-red-400" />}
        <span className="font-medium">{isLocal ? 'You' : label}</span>
      </div>
    </div>
  );
}
