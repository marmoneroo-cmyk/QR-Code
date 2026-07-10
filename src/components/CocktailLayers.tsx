'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import type { LayerConfig } from '@/data/cocktail';

interface TiltSource {
  current: { x: number; y: number };
}

/**
 * Keys out the near-black background baked into some layer PNGs (e.g.
 * citrus-lime-sour) that lack a real alpha channel. Derives alpha from pixel
 * luminance so a black background becomes transparent — the 3D equivalent of
 * `mix-blend-screen`. Images that already have clean alpha (e.g.
 * smoked-old-fashioned) are unaffected because their black areas are already
 * transparent. Stable identity so the shader compiles once.
 */
function keyOutBlackBackground(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <alphamap_fragment>',
    `#include <alphamap_fragment>
    {
      float _lum = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
      diffuseColor.a *= smoothstep(0.015, 0.14, _lum);
    }`
  );
}

interface CocktailLayersProps {
  layers: readonly LayerConfig[];
  activeLayerId: string | null;
  onHoverLayer: (id: string | null) => void;
  tiltRef?: TiltSource;
}

export function CocktailLayers({
  layers,
  activeLayerId,
  onHoverLayer,
  tiltRef,
}: CocktailLayersProps) {
  const hasActive = activeLayerId !== null;
  return (
    <group>
      {layers.map((layer, i) => (
        <CocktailLayer
          key={layer.id}
          config={layer}
          index={i}
          isActive={activeLayerId === layer.id}
          isDimmed={hasActive && activeLayerId !== layer.id}
          onHover={onHoverLayer}
          tiltRef={tiltRef}
        />
      ))}
    </group>
  );
}

interface CocktailLayerProps {
  config: LayerConfig;
  index: number;
  isActive: boolean;
  isDimmed: boolean;
  onHover: (id: string | null) => void;
  tiltRef?: TiltSource;
}

function CocktailLayer({ config, index, isActive, isDimmed, onHover, tiltRef }: CocktailLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const texture = useTexture(config.image);
  const { viewport } = useThree();
  const mouseCurrent = useRef({ x: 0, y: 0 });
  const scaleCurrent = useRef(1);
  const emissiveCurrent = useRef(0);
  const opacityCurrent = useRef(1);

  const aspect = useMemo(() => {
    const img = texture.image as HTMLImageElement | undefined;
    if (img && img.width && img.height) {
      return img.width / img.height;
    }
    return 1;
  }, [texture]);

  const reduce = useReducedMotion();

  useFrame(({ pointer, clock }) => {
    if (!meshRef.current) return;

    const t = clock.getElapsedTime();

    const tilt = tiltRef?.current ?? { x: 0, y: 0 };
    // Uniform gentle sway for the whole stack — same offset for every layer so
    // the column stays perfectly aligned on the centre axis (no sideways spread).
    const swayX = (pointer.x + tilt.x) * viewport.width * 0.012;
    const swayY = (pointer.y - tilt.y) * viewport.height * 0.012;

    const lerpFactor = 0.04;
    mouseCurrent.current.x += (swayX - mouseCurrent.current.x) * lerpFactor;
    mouseCurrent.current.y += (swayY - mouseCurrent.current.y) * lerpFactor;

    // Vertical-only float bob (no horizontal drift) keeps items on a straight line.
    // Stilled for reduced-motion guests — pointer/tilt sway stays (it's user-controlled).
    const floatY = reduce ? 0 : Math.sin(t * config.floatSpeed + index * 0.8) * config.floatAmp;

    meshRef.current.position.x = mouseCurrent.current.x;
    meshRef.current.position.y = config.y + mouseCurrent.current.y + floatY;
    meshRef.current.position.z = config.z;

    // Whisper of uniform tilt — never enough to break the vertical column.
    meshRef.current.rotation.z = mouseCurrent.current.x * 0.01;
    meshRef.current.rotation.x = -mouseCurrent.current.y * 0.005;
    meshRef.current.rotation.y = 0;

    const targetScale = isActive ? 1.08 : 1.0;
    scaleCurrent.current += (targetScale - scaleCurrent.current) * 0.1;
    meshRef.current.scale.setScalar(scaleCurrent.current);

    const targetEmissive = isActive ? 0.45 : 0.0;
    emissiveCurrent.current += (targetEmissive - emissiveCurrent.current) * 0.1;

    const targetOpacity = isDimmed ? 0.2 : 1.0;
    opacityCurrent.current += (targetOpacity - opacityCurrent.current) * 0.08;

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = emissiveCurrent.current;
      materialRef.current.opacity = opacityCurrent.current;
    }
  });

  const planeWidth = config.scale * aspect;
  const planeHeight = config.scale;

  return (
    <mesh
      ref={meshRef}
      position={[0, config.y, config.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(config.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
        document.body.style.cursor = '';
      }}
    >
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0}
        transparent
        alphaTest={0.04}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
        onBeforeCompile={keyOutBlackBackground}
      />
    </mesh>
  );
}
