import { useEffect, useState } from 'react';

/** Touch-primary devices (phones/tablets), not mouse-driven laptops/desktops. */
export function useMobileCameraDevice(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return mobile;
}
