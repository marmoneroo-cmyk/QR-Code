'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LuxuryLighting() {
  const keyLightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(({ clock }) => {
    if (keyLightRef.current) {
      const t = clock.getElapsedTime();
      keyLightRef.current.position.x = 3 + Math.sin(t * 0.15) * 0.5;
      keyLightRef.current.position.y = 4 + Math.cos(t * 0.1) * 0.3;
      keyLightRef.current.intensity = 1.8 + Math.sin(t * 0.2) * 0.1;
    }
  });

  return (
    <>
      {/* Soft ambient fill */}
      <ambientLight intensity={0.15} color="#f5e6d3" />

      {/* Cinematic key light - warm, from upper right */}
      <directionalLight
        ref={keyLightRef}
        position={[3, 4, 5]}
        intensity={1.8}
        color="#ffeedd"
        castShadow={false}
      />

      {/* Subtle rim light - cool blue from behind */}
      <directionalLight
        position={[-2, 1, -3]}
        intensity={0.3}
        color="#aaccff"
      />

      {/* Bottom fill - very subtle warm glow */}
      <pointLight
        position={[0, -3, 2]}
        intensity={0.4}
        color="#ff9966"
        distance={8}
        decay={2}
      />
    </>
  );
}
