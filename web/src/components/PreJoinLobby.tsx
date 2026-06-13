import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, Select } from './ui';

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
  const [permError, setPermError] = useState<string | null>(null);

  const startPreview = useCallback(async (audio?: string, video?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? { deviceId: { exact: audio } } : true,
        video: video ? { deviceId: { exact: video } } : true,
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
  }, [micOn, camOn]);

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

  function handleJoin() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onJoin({ micEnabled: micOn, cameraEnabled: camOn });
  }

  return (
    <div className="w-full max-w-lg animate-fade-in">
      <div className="mb-6 text-center">
        <p className="section-label">Pre-join check</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg">{sessionTitle}</h1>
        <p className="mt-1 text-sm text-muted">Test your devices before entering the call.</p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line bg-[#0c0c0e] aspect-video">
        {!camOn && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#141416] text-muted">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface-2 text-2xl font-semibold text-fg">
              {(name.trim() || '?').charAt(0).toUpperCase()}
            </div>
            <p className="mt-3 text-sm">Camera off</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover mirror ${camOn ? '' : 'opacity-0'}`}
        />
        {!micOn && camOn && (
          <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
            Mic off
          </span>
        )}
      </div>

      {(permError || error) && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {permError ?? error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-center gap-3">
        <MediaToggle
          active={micOn}
          onClick={() => setMicOn((v) => !v)}
          label={micOn ? 'Mute microphone' : 'Unmute microphone'}
          icon={micOn ? 'mic' : 'mic-off'}
        />
        <MediaToggle
          active={camOn}
          onClick={() => setCamOn((v) => !v)}
          label={camOn ? 'Turn off camera' : 'Turn on camera'}
          icon={camOn ? 'cam' : 'cam-off'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        className="mt-4 text-center"
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
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: 'mic' | 'mic-off' | 'cam' | 'cam-off';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-lg border transition ${
        active
          ? 'border-line bg-surface text-fg hover:bg-surface-2'
          : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
      }`}
    >
      {icon === 'mic' && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V21H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.08A7 7 0 0 0 19 11Z" />
        </svg>
      )}
      {icon === 'mic-off' && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M19 11a7 7 0 0 1-.09 1.09l2 1.52a1 1 0 0 0 1.24-1.56l-1.9-1.45A9 9 0 0 0 21 11a1 1 0 1 0-2 0ZM12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-2.82 3H9v3a3 3 0 0 0 3 3Zm-7-3a1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V21H5a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.08A7 7 0 0 0 5 11Z" />
        </svg>
      )}
      {icon === 'cam' && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
        </svg>
      )}
      {icon === 'cam-off' && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M3.27 2 2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12l2.73 2.73L21 20.46 3.27 2ZM17 10.5V7a1 1 0 0 0-1-1h-2.18l2 2H17Zm3 1.5v2.18l2 2V12a1 1 0 0 0-1-1h-1Z" />
        </svg>
      )}
    </button>
  );
}
