'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { CocktailConfig, Lang } from '@/data/cocktail';

interface MobileLabelSheetProps {
  config: CocktailConfig;
  activeLayerId: string | null;
  onClose: () => void;
  lang: Lang;
}

export function MobileLabelSheet({ config, activeLayerId, onClose, lang }: MobileLabelSheetProps) {
  const isHebrew = lang === 'he';
  const descFont = isHebrew
    ? 'var(--font-rubik, sans-serif)'
    : 'var(--font-garamond, serif)';

  const label = activeLayerId
    ? config.labels.find((l) => l.layerId === activeLayerId)
    : null;

  return (
    <div className="md:hidden">
      <AnimatePresence>
        {label && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6"
          >
            <div
              className="bg-black/85 backdrop-blur-lg border border-amber-200/30 rounded-2xl p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.7)]"
              dir={isHebrew ? 'rtl' : 'ltr'}
              lang={lang}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3
                  className="text-white text-xl drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] font-serif"
                  style={{
                    fontStyle: isHebrew ? 'normal' : 'italic',
                    fontWeight: 500,
                  }}
                >
                  {label.name[lang]}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="shrink-0 w-7 h-7 rounded-full border border-amber-200/40 text-amber-200/70 hover:text-amber-100 flex items-center justify-center text-sm"
                >
                  ×
                </button>
              </div>
              {label.origin && (
                <p
                  className="text-amber-200/85 text-10 tracking-[0.25em] uppercase mb-2 font-sans"
                >
                  {label.origin[lang]}
                </p>
              )}
              <p
                className="text-white/85 text-sm leading-relaxed"
                style={{ fontFamily: descFont, fontWeight: isHebrew ? 300 : 400 }}
              >
                {label.description[lang]}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
