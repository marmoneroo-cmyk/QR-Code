'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

export function useGyroscope() {
  const tiltRef = useRef({ x: 0, y: 0 });
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;
    // gamma: left-right tilt (-90 to 90)
    // beta: front-back tilt (-180 to 180); assume user holds phone tilted ~45° forward when reading
    tiltRef.current = {
      x: Math.max(-1, Math.min(1, gamma / 30)),
      y: Math.max(-1, Math.min(1, (beta - 45) / 30)),
    };
  }, []);

  const enable = useCallback(async () => {
    if (typeof window === 'undefined') return false;
    const Ctor = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & DeviceOrientationEventStatic)
      | undefined;
    if (!Ctor) return false;

    if (typeof Ctor.requestPermission === 'function') {
      try {
        const result = await Ctor.requestPermission();
        if (result !== 'granted') return false;
      } catch {
        return false;
      }
    }

    window.addEventListener('deviceorientation', handleOrientation);
    setEnabled(true);
    setPermissionRequired(false);
    return true;
  }, [handleOrientation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & DeviceOrientationEventStatic)
      | undefined;
    if (!Ctor) return;

    // iOS 13+ requires permission via user gesture — cannot auto-enable
    if (typeof Ctor.requestPermission === 'function') {
      setPermissionRequired(true);
      return;
    }

    window.addEventListener('deviceorientation', handleOrientation);
    setEnabled(true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  return { tiltRef, enable, permissionRequired, enabled };
}
