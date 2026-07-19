'use client';

import { useRef, useState } from 'react';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLang } from '@/lib/useLang';

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
  const tablistRef = useRef<HTMLDivElement>(null);

  const focusTabAt = (index: number) => {
    const el = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index];
    el?.focus();
  };

  const handleTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const count = tabs.length;
    if (count === 0) return;
    const currentIndex = tabs.findIndex((tb) => tb.id === active?.id);
    // In RTL, the visual left/right arrows are swapped relative to DOM order.
    const nextKey = isHe ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = isHe ? 'ArrowRight' : 'ArrowLeft';

    let nextIndex: number | null = null;
    if (e.key === nextKey) {
      nextIndex = (currentIndex + 1) % count;
    } else if (e.key === prevKey) {
      nextIndex = (currentIndex - 1 + count) % count;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = count - 1;
    }

    if (nextIndex === null) return;
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      setTabId(nextTab.id);
      focusTabAt(nextIndex);
    }
  };

  return (
    <>
      <div
        ref={tablistRef}
        className="glass-chrome backdrop-blur-xl inline-flex flex-wrap gap-1.5 mb-9 max-w-full rounded-full p-1.5"
        role="tablist"
        dir={isHe ? 'rtl' : 'ltr'}
        onKeyDown={handleTablistKeyDown}
      >
        {tabs.map((tb) => {
          const isActive = tb.id === active?.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              id={`tab-${tb.id}`}
              aria-controls={`panel-${tb.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setTabId(tb.id)}
              className={`font-sans inline-flex items-center gap-2 rounded-full px-4 py-2 text-11 tracking-[0.18em] uppercase transition-all duration-200 ${
                isActive
                  ? 'text-black'
                  : 'text-white/50 hover:bg-white/[0.05] hover:text-white/85'
              }`}
              style={{
                background: isActive ? 'linear-gradient(105deg, var(--champagne-bright), var(--champagne))' : undefined,
              }}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-black/80' : 'text-white/40'} />
              {isHe ? tb.he : tb.en}
            </button>
          );
        })}
      </div>

      {ActivePanel ? (
        <div role="tabpanel" id={`panel-${active?.id}`} aria-labelledby={`tab-${active?.id}`} tabIndex={0}>
          <ActivePanel />
        </div>
      ) : null}
    </>
  );
}
