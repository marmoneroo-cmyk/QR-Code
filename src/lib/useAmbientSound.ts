'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'cocktail-demo:ambient';

interface AmbientNodes {
  context: AudioContext;
  master: GainNode;
  oscillators: OscillatorNode[];
}

function createAmbient(): AmbientNodes {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new Ctor();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  // Low-pass to keep things soft
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.7;
  filter.connect(master);

  // Three detuned oscillators for a warm drone
  const baseFreq = 110; // A2
  const detunes = [0, -7, 12]; // root, slightly flat fifth, octave
  const oscillators: OscillatorNode[] = [];
  for (const cents of detunes) {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = baseFreq;
    osc.detune.value = cents;
    const oscGain = context.createGain();
    oscGain.gain.value = 0.3;
    osc.connect(oscGain);
    oscGain.connect(filter);
    osc.start();
    oscillators.push(osc);
  }

  return { context, master, oscillators };
}

export function useAmbientSound() {
  const nodesRef = useRef<AmbientNodes | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(true);

  // Hydrate preference
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'on') {
        setMuted(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (!nodesRef.current) {
        nodesRef.current = createAmbient();
        setEnabled(true);
      }
      const { context, master } = nodesRef.current;
      if (context.state === 'suspended') {
        await context.resume();
      }
      const nextMuted = !muted;
      const target = nextMuted ? 0 : 0.08; // very subtle peak gain
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(target, now + 1.5);
      setMuted(nextMuted);
      try {
        window.localStorage.setItem(STORAGE_KEY, nextMuted ? 'off' : 'on');
      } catch {
        // ignore
      }
    } catch {
      // fail silently if audio is blocked
    }
  }, [muted]);

  useEffect(() => {
    return () => {
      if (nodesRef.current) {
        try {
          for (const osc of nodesRef.current.oscillators) {
            osc.stop();
            osc.disconnect();
          }
          nodesRef.current.master.disconnect();
          void nodesRef.current.context.close();
        } catch {
          // ignore
        }
        nodesRef.current = null;
      }
    };
  }, []);

  return { enabled, muted, toggle };
}
