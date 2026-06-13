import { useEffect, useState } from 'react';

/** Heuristic for phones/tablets — many Android browsers fail `(hover: none) and (pointer: coarse)`. */
function guessTouchCameraDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const touch = navigator.maxTouchPoints > 0;
  const narrow = window.innerWidth <= 900;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;

  return mobileUa || (touch && narrow) || (coarsePointer && noHover);
}

/** True when the device likely has front/back cameras (show flip control). */
export function useCanFlipCamera(): boolean {
  const [canFlip, setCanFlip] = useState(guessTouchCameraDevice);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (guessTouchCameraDevice()) {
        if (!cancelled) setCanFlip(true);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (!cancelled) setCanFlip(videoInputs.length >= 2);
      } catch {
        if (!cancelled) setCanFlip(guessTouchCameraDevice());
      }
    };

    void refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, []);

  return canFlip;
}

/** @deprecated Use useCanFlipCamera */
export function useMobileCameraDevice(): boolean {
  return useCanFlipCamera();
}
