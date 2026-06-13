import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, Select } from './ui';
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon } from './MediaIcons';

export interface MediaPrefs {
  micEnabled: boolean;
  cameraEnabled: boolean;
}

interface Props {
  sessionTitle: string;
  name: string;
  onNameChange: (name: string) => void;
  busy?: boolean;
  error?: string | null;
  onJoin: (prefs: MediaPrefs) => void;
}

export function PreJoinLobby({ sessionTitle, name, onNameChange, busy, error, onJoin }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({
    audio: [],
    video: [],
  });
  const [audioId, setAudioId] = useState('');
  const [videoId, setVideoId] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [permError, setPermError] = useState<string | null>(null);

  const startPreview = useCallback(async (audio?: string, video?: string, facing?: 'user' | 'environment') => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const mode = facing ?? facingMode;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? { deviceId: { exact: audio } } : true,
        video: video
          ? { deviceId: { exact: video } }
          : { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
      setPermError(null);

      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audio: all.filter((d) => d.kind === 'audioinput'),
        video: all.filter((d) => d.kind === 'videoinput'),
      });
    } catch {
      setPermError('Allow camera and microphone access to preview before joining.');
    }
  }, [micOn, camOn, facingMode]);

  useEffect(() => {
    startPreview();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = micOn));
    }
  }, [micOn]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = camOn));
    }
  }, [camOn]);

  function switchDevices(aId: string, vId: string) {
    setAudioId(aId);
    setVideoId(vId);
    startPreview(aId || undefined, vId || undefined);
  }

  function flipCamera() {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    setVideoId('');
    startPreview(audioId || undefined, undefined, next);
  }

  function handleJoin() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onJoin({ micEnabled: micOn, cameraEnabled: camOn });
  }

  return (
    <div className="w-full animate-fade-in">
      <div className="mb-5">
        <p className="section-label">Before you join</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-fg sm:text-2xl">{sessionTitle}</h1>
        <p className="mt-1 text-sm text-muted">Check your camera and microphone, then join the call.</p>
      </div>

      {/* Video preview with in-frame controls */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-[#0c0c0e] aspect-video shadow-card">
        {!camOn && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#141416]">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/5 text-2xl font-bold text-white">
              {(name.trim() || '?').charAt(0).toUpperCase()}
            </div>
            <p className="mt-3 text-sm text-white/50">Camera is off</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-contain mirror ${camOn ? '' : 'opacity-0'}`}
        />

        {/* Status chips */}
        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-2">
          {!micOn && (
            <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              Mic off
            </span>
          )}
        </div>

        {/* Meet-style media controls */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
          <MediaToggle
            active={micOn}
            onClick={() => setMicOn((v) => !v)}
            label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            kind="mic"
          />
          <MediaToggle
            active={camOn}
            onClick={() => setCamOn((v) => !v)}
            label={camOn ? 'Turn off camera' : 'Turn on camera'}
            kind="cam"
          />
          {camOn && (
            <MediaToggle
              active
              onClick={flipCamera}
              label="Switch camera (front/back)"
              kind="flip"
            />
          )}
        </div>
      </div>

      {(permError || error) && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {permError ?? error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-left">
          <span className="label">Microphone</span>
          <Select value={audioId} onChange={(e) => switchDevices(e.target.value, videoId)}>
            <option value="">Default</option>
            {devices.audio.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Microphone'}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-left">
          <span className="label">Camera</span>
          <Select value={videoId} onChange={(e) => switchDevices(audioId, e.target.value)}>
            <option value="">Default</option>
            {devices.video.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Camera'}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Field
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Your name (optional)"
        className="mt-4"
      />

      <Button onClick={handleJoin} disabled={busy || !!permError} className="mt-4 w-full py-3">
        {busy ? 'Joining…' : 'Join call'}
      </Button>

      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
}

function MediaToggle({
  active,
  onClick,
  label,
  kind,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  kind: 'mic' | 'cam' | 'flip';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-12 w-12 place-items-center rounded-full transition-all active:scale-95 ${
        active
          ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md ring-1 ring-white/20'
          : 'bg-red-600 text-white hover:bg-red-500 shadow-lg ring-2 ring-red-400/50'
      }`}
    >
      {kind === 'mic' ? (
        active ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />
      ) : kind === 'flip' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 8h10l-2-2m2 2-2 2 2M17 16H7l2 2m-2-2 2-2-2-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : active ? (
        <CameraIcon className="h-5 w-5" />
      ) : (
        <CameraOffIcon className="h-5 w-5" />
      )}
    </button>
  );
}
