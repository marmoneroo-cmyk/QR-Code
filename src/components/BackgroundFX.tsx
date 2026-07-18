'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const PARTICLE_COUNT = 18;
// Touch devices get a calmer, cheaper field: fewer animated blurred nodes, and no
// cursor-spotlight (there's no pointer to follow), which drops a per-frame rAF loop.
const PARTICLE_COUNT_COARSE = 10;
const PARTICLE_COLORS = [
  'rgba(252, 211, 77, 0.4)',
  'rgba(252, 211, 77, 0.3)',
  'rgba(255, 255, 255, 0.3)',
  'rgba(244, 114, 182, 0.25)',
];

interface ParticleSpec {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  blur: number;
  color: string;
  drift: number;
}

// Deterministic seeded PRNG (mulberry32) so the server and client render the
// EXACT same particles — random Math.random() here caused a hydration mismatch.
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(): ParticleSpec[] {
  const rand = mulberry32(0x9e3779b9);
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
    id,
    left: rand() * 100,
    delay: rand() * 25,
    duration: 32 + rand() * 28,
    size: 4 + rand() * 5,
    blur: 2 + rand() * 3,
    color: PARTICLE_COLORS[Math.floor(rand() * PARTICLE_COLORS.length)]!,
    drift: -25 + rand() * 50,
  }));
}

export function BackgroundFX() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });
  // SSR renders the full desktop field; after mount we downgrade on coarse pointers.
  const [isCoarse, setIsCoarse] = useState(false);
  const particles = useMemo(() => buildParticles(), []);
  const shownParticles = isCoarse ? particles.slice(0, PARTICLE_COUNT_COARSE) : particles;

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isCoarse) return; // no cursor to follow on touch — skip the mousemove rAF loop entirely
    let frame = 0;
    let pending = { x: 50, y: 50 };
    const handle = (event: MouseEvent) => {
      pending = {
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      };
      if (!frame) {
        frame = requestAnimationFrame(() => {
          setSpotlight(pending);
          frame = 0;
        });
      }
    };
    window.addEventListener('mousemove', handle);
    return () => {
      window.removeEventListener('mousemove', handle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isCoarse]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />

      <motion.div
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[120vw] h-[120vh] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(190, 24, 93, 0.16), rgba(120, 53, 15, 0.06) 35%, transparent 65%)',
          filter: 'blur(70px)',
        }}
        animate={{ scale: [1, 1.06, 1], opacity: [0.65, 0.95, 0.65] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(252, 211, 77, 0.1), transparent 70%)',
          filter: 'blur(90px)',
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.05), transparent 70%)',
          filter: 'blur(90px)',
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />

      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(1000px circle at ${spotlight.x}% ${spotlight.y}%, rgba(252, 211, 77, 0.035), transparent 70%)`,
        }}
      />

      <div className="absolute inset-0">
        {shownParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              bottom: '-20px',
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              filter: `blur(${p.blur}px)`,
            }}
            initial={{ y: 0, x: 0, opacity: 0 }}
            animate={{
              y: '-110vh',
              x: p.drift,
              opacity: [0, 0.7, 0.7, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.15, 0.85, 1],
            }}
          />
        ))}
      </div>

      <div
        className="absolute inset-0 mix-blend-overlay opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='180' height='180' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
    </div>
  );
}
