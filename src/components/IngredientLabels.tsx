'use client';

import { motion } from 'framer-motion';
import type { CocktailConfig, Lang, LayerConfig } from '@/data/cocktail';

const SCENE_HEIGHT_AT_CAMERA = 4.14;

function screenYPercent(layerY: number): number {
  const halfHeight = SCENE_HEIGHT_AT_CAMERA / 2;
  const pct = ((halfHeight - layerY) / SCENE_HEIGHT_AT_CAMERA) * 100;
  return Math.max(6, Math.min(94, pct));
}

interface IngredientLabelsProps {
  config: CocktailConfig;
  activeLayerId: string | null;
  onHoverLabel: (id: string | null) => void;
  lang: Lang;
}

export function IngredientLabels({
  config,
  activeLayerId,
  onHoverLabel,
  lang,
}: IngredientLabelsProps) {
  const layerById = new Map<string, LayerConfig>(
    config.layers.map((layer) => [layer.id, layer])
  );

  const isHebrew = lang === 'he';
  // Labels always sit to the RIGHT of the centre column for both languages —
  // Hebrew simply renders right-to-left on the same side.
  const labelsOnRight = true;
  const descFont = isHebrew
    ? 'var(--font-rubik, sans-serif)'
    : 'var(--font-garamond, Georgia, serif)';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none hidden md:block">
      {config.labels.map((label, i) => {
        const layer = layerById.get(label.layerId);
        if (!layer) return null;
        const topPct = screenYPercent(layer.y);
        const isActive = activeLayerId === label.layerId;

        return (
          <motion.div
            key={label.id}
            className="absolute"
            style={{
              top: `${topPct}%`,
              left: labelsOnRight ? 'calc(50% + 5rem)' : 'auto',
              right: labelsOnRight ? 'auto' : 'calc(50% + 5rem)',
              transform: 'translateY(-50%)',
            }}
            initial={{ opacity: 0, x: labelsOnRight ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.6 + i * 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div
              className={`flex items-center gap-3 pointer-events-auto cursor-pointer ${
                labelsOnRight ? '' : 'flex-row-reverse'
              }`}
              onMouseEnter={() => onHoverLabel(label.layerId)}
              onMouseLeave={() => onHoverLabel(null)}
              onFocus={() => onHoverLabel(label.layerId)}
              onBlur={() => onHoverLabel(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  onHoverLabel(label.layerId);
                }
              }}
              tabIndex={0}
              role="button"
              aria-expanded={isActive}
              dir={isHebrew ? 'rtl' : 'ltr'}
              lang={lang}
            >
              {/* Dot + connector line (line goes toward the layer in the center) */}
              <div className={`flex items-center shrink-0 ${labelsOnRight ? '' : 'flex-row-reverse'}`}>
                <div
                  className="h-px transition-all duration-500"
                  style={{
                    width: 36,
                    backgroundColor: 'var(--accent)',
                    opacity: isActive ? 1 : 0.5,
                    boxShadow: isActive ? '0 0 8px var(--accent)' : 'none',
                  }}
                />
                <div
                  className={`rounded-full transition-all duration-500 ${
                    isActive ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'
                  }`}
                  style={{
                    backgroundColor: 'var(--accent)',
                    opacity: isActive ? 1 : 0.7,
                    boxShadow: isActive ? '0 0 12px var(--accent)' : 'none',
                  }}
                />
              </div>

              {/* Text block — label title in orange caps, description italic light */}
              <div className="w-[170px] overflow-hidden">
                <span
                  className="block uppercase tracking-[0.22em] transition-all duration-500 truncate font-sans"
                  style={{
                    fontWeight: 500,
                    fontSize: isActive ? '16px' : '15px',
                    letterSpacing: '0.22em',
                    color: 'var(--accent)',
                    textShadow: isActive ? '0 0 14px var(--accent)' : 'none',
                  }}
                >
                  {label.name[lang]}
                </span>
                {isActive && (
                  <p
                    className="leading-snug transition-all duration-500 text-white/90 mt-1.5"
                    style={{
                      fontFamily: descFont,
                      fontStyle: isHebrew ? 'normal' : 'italic',
                      fontWeight: isHebrew ? 300 : 400,
                      fontSize: '15px',
                    }}
                  >
                    {label.description[lang]}
                  </p>
                )}
                {label.origin && isActive && (
                  <p
                    className="mt-1.5 text-10 tracking-[0.25em] uppercase font-sans"
                    style={{ color: 'var(--accent)', opacity: 0.75 }}
                  >
                    {label.origin[lang]}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
