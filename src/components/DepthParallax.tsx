'use client';

import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface DepthParallaxProps {
  image: string;
  depth: string;
  /** Aspect ratio width/height of the source image. */
  aspect?: number;
  /** How far near pixels pop toward the camera (world units). */
  relief?: number;
  className?: string;
}

function ParallaxPlane({ image, depth, aspect, relief }: Required<Omit<DepthParallaxProps, 'className'>>) {
  const meshRef = useRef<THREE.Mesh>(null);
  const colorTex = useTexture(image);
  const depthTex = useTexture(depth);
  const { viewport } = useThree();
  const cur = useRef({ x: 0, y: 0 });

  // Fit the plane to ~92% of the available viewport, preserving aspect.
  const h = Math.min(viewport.height, viewport.width / aspect) * 0.94;
  const w = h * aspect;

  useFrame(({ pointer, clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    // Idle sway blended with pointer control.
    const idleX = Math.sin(t * 0.4) * 0.06;
    const idleY = Math.cos(t * 0.3) * 0.035;
    const targetX = pointer.x * 0.32 + idleX;
    const targetY = pointer.y * 0.26 + idleY;
    cur.current.x += (targetX - cur.current.x) * 0.06;
    cur.current.y += (targetY - cur.current.y) * 0.06;
    meshRef.current.rotation.y = cur.current.x;
    meshRef.current.rotation.x = -cur.current.y;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[w, h, 220, 280]} />
      <meshStandardMaterial
        map={colorTex}
        emissiveMap={colorTex}
        emissive={'#ffffff'}
        emissiveIntensity={1}
        displacementMap={depthTex}
        displacementScale={h * relief}
        displacementBias={-h * relief * 0.5}
        roughness={1}
        metalness={0}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Depth-parallax 3D viewer: renders ONE high-res image displaced by its depth
 * map so the drink gains real 3D relief, tilting with the pointer / idle sway.
 * Full resolution, perfectly consistent, free — no frame sequence needed.
 */
export function DepthParallax({ image, depth, aspect = 1122 / 1402, relief = 0.16, className }: DepthParallaxProps) {
  return (
    <div className={className} style={{ touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
        <ambientLight intensity={1} />
        <Suspense fallback={null}>
          <ParallaxPlane image={image} depth={depth} aspect={aspect} relief={relief} />
        </Suspense>
      </Canvas>
    </div>
  );
}
