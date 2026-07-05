'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '@/lib/useLang';

const sans = 'var(--font-inter, sans-serif)';

export interface AdminTabDef {
  id: string;
  en: string;
  he: string;
  icon: LucideIcon;
  /** The section's inner content (NO AdminShell). Only the ACTIVE tab mounts,
   *  so each panel's fetch/polling runs only while visible. */
  Panel: ComponentType;
}

interface AdminTabsProps {
  tabs: ReadonlyArray<AdminTabDef>;
  initial?: string;
}

/**
 * Shared segmented tab-switcher for consolidated admin destinations (Today,
 * Results, Promote, Menu Analysis, Guests…). Generalises the original
 * menu-analysis pattern into one component so every grouped screen looks
 * identical. Champagne active state, RTL-aware, lazy per-tab mount.
 */
export function AdminTabs({ tabs, initial }: AdminTabsProps) {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const [tabId, setTabId] = useState<string>(initial ?? tabs[0]?.id ?? '');
  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const ActivePanel = active?.Panel;

  return (
    <>
      <div
        className="glass-chrome backdrop-blur-xl inline-flex flex-wrap gap-1.5 mb-9 max-w-full rounded-full p-1.5"
        role="tablist"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {tabs.map((tb) => {
          const isActive = tb.id === active?.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTabId(tb.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] tracking-[0.18em] uppercase transition-all duration-200 ${
                isActive
                  ? 'text-black'
                  : 'text-white/50 hover:bg-white/[0.05] hover:text-white/85'
              }`}
              style={{
                fontFamily: sans,
                background: isActive ? 'linear-gradient(105deg, var(--champagne-bright), var(--champagne))' : undefined,
              }}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-black/80' : 'text-white/40'} />
              {isHe ? tb.he : tb.en}
            </button>
          );
        })}
      </div>

      {ActivePanel ? <ActivePanel /> : null}
    </>
  );
}
