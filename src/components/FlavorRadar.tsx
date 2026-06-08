'use client';

import { motion } from 'framer-motion';
import { FLAVOR_LABEL, type FlavorProfile, type Lang } from '@/data/cocktail';

interface FlavorRadarProps {
  flavor: FlavorProfile;
  lang: Lang;
  size?: number;
}

const AXES: Array<keyof FlavorProfile> = ['sweet', 'bitter', 'citrus', 'smoky', 'herbal'];

function polarPoint(cx: number, cy: number, radius: number, angleRad: number): [number, number] {
  return [cx + radius * Math.cos(angleRad), cy + radius * Math.sin(angleRad)];
}

export function FlavorRadar({ flavor, lang, size = 220 }: FlavorRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.36;
  const labelRadius = size * 0.48;

  const angle = (i: number): number => -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const dataPoints = AXES.map((axis, i) => {
    const value = Math.max(0, Math.min(5, flavor[axis])) / 5;
    return polarPoint(cx, cy, maxRadius * value, angle(i));
  });

  const dataPath = dataPoints
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .concat('Z')
    .join(' ');

  const isHebrew = lang === 'he';
  const labelFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';

  return (
    <div className="inline-block">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <defs>
          <radialGradient id="flavor-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252,211,77,0.45)" />
            <stop offset="100%" stopColor="rgba(190,24,93,0.2)" />
          </radialGradient>
        </defs>

        {gridLevels.map((level) => {
          const points = AXES.map((_, i) => {
            const [x, y] = polarPoint(cx, cy, maxRadius * level, angle(i));
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="rgba(252,211,77,0.1)"
              strokeWidth={1}
            />
          );
        })}

        {AXES.map((_, i) => {
          const [x, y] = polarPoint(cx, cy, maxRadius, angle(i));
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(252,211,77,0.12)"
              strokeWidth={1}
            />
          );
        })}

        <motion.path
          d={dataPath}
          fill="url(#flavor-fill)"
          stroke="rgba(252,211,77,0.85)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {dataPoints.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill="rgba(252,211,77,0.95)"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.06 }}
          />
        ))}

        {AXES.map((axis, i) => {
          const [x, y] = polarPoint(cx, cy, labelRadius, angle(i));
          return (
            <text
              key={axis}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.65)"
              fontSize={10}
              letterSpacing="0.2em"
              style={{ fontFamily: labelFont, textTransform: 'uppercase' }}
            >
              {FLAVOR_LABEL[axis][lang]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
