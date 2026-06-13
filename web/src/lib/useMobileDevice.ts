import { useEffect, useState } from 'react';

/** Match Tailwind `lg` — flip is a mobile control, hidden on desktop layouts. */
const FLIP_MAX_WIDTH_PX = 1023;

/** Heuristic for phones/tablets — many Android browsers fail `(hover: none) and (pointer: coarse)`. */
function guessTouchCameraDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const touch = navigator.maxTouchPoints > 0;
  const narrow = window.innerWidth <= FLIP_MAX_WIDTH_PX;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;

  return mobileUa || (touch && narrow) || (coarsePointer && noHover);
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${FLIP_MAX_WIDTH_PX}px)`).matches;
}

/** True on mobile-sized viewports when front/back camera switching is useful. */
export function useCanFlipCamera(): boolean {
  const [canFlip, setCanFlip] = useState(() => isMobileViewport() && guessTouchCameraDevice());

  useEffect(() => {
    let cancelled = false;
    const viewportMq = window.matchMedia(`(max-width: ${FLIP_MAX_WIDTH_PX}px)`);

    const refresh = async () => {
      if (!isMobileViewport()) {
        if (!cancelled) setCanFlip(false);
        return;
      }
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

    const onViewportChange = () => void refresh();

    void refresh();
    viewportMq.addEventListener('change', onViewportChange);
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => {
      cancelled = true;
      viewportMq.removeEventListener('change', onViewportChange);
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, []);

  return canFlip;
}

/** @deprecated Use useCanFlipCamera */
export function useMobileCameraDevice(): boolean {
  return useCanFlipCamera();
}
