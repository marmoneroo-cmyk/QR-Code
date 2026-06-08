'use client';

import { motion } from 'framer-motion';
import { CURRENCY_SYMBOL, type Currency } from '@/data/cocktail';

interface CurrencyToggleProps {
  currency: Currency;
  onChange: (c: Currency) => void;
  className?: string;
}

const OPTIONS: ReadonlyArray<Currency> = ['ILS', 'USD', 'EUR'];

export function CurrencyToggle({ currency, onChange, className = '' }: CurrencyToggleProps) {
  return (
    <motion.div
      className={`pointer-events-auto ${className}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center border border-amber-200/30 rounded-full overflow-hidden backdrop-blur-sm bg-black/30">
        {OPTIONS.map((opt) => {
          const isActive = currency === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-all duration-300 ${
                isActive ? 'bg-amber-200/90 text-black' : 'text-amber-200/70 hover:text-amber-200'
              }`}
              style={{ fontFamily: 'var(--font-inter, sans-serif)', fontWeight: 500 }}
            >
              {CURRENCY_SYMBOL[opt]} {opt}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
