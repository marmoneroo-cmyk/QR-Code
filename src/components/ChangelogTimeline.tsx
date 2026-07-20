'use client';

import { useMemo, useState } from 'react';
import { renderInline, type ChangelogVersion } from '@/lib/parseChangelog';
import { useLang } from '@/lib/useLang';

const body = 'var(--font-garamond, serif)';
const heBody = 'var(--font-rubik, sans-serif)';

interface ChangelogTimelineProps {
  en: ChangelogVersion[];
  he: ChangelogVersion[];
}

/** "2026-07-10" → Date (UTC noon so timezones can't shift the day). Null when not a date. */
function versionDate(v: ChangelogVersion): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.version)) return null;
  const d = new Date(`${v.version}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Renders the changelog in the active language, in one of two views:
 *
 * - Timeline (default): one collapsible row per release. Only the newest release
 *   starts open — the full log used to dump everything at once, which made a
 *   50KB wall of text.
 * - Calendar: a month grid with release days marked; clicking a marked day jumps
 *   back to the timeline with that release expanded.
 */
export function ChangelogTimeline({ en, he }: ChangelogTimelineProps) {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const versions = isHebrew && he.length > 0 ? he : en;
  const bodyFont = isHebrew ? heBody : body;

  const [view, setView] = useState<'timeline' | 'calendar'>('timeline');
  // Newest release open by default; the rest fold to a single header line.
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const jumpToVersion = (i: number) => {
    setOpen((prev) => new Set(prev).add(i));
    setView('timeline');
    // Element exists only after the view switch renders.
    requestAnimationFrame(() => {
      document.getElementById(`release-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Calendar months, newest first: key "YYYY-MM" → day-of-month → version indices.
  const months = useMemo(() => {
    const map = new Map<string, { year: number; month: number; days: Map<number, number[]> }>();
    versions.forEach((v, i) => {
      const d = versionDate(v);
      if (!d) return;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, '0')}`;
      const entry = map.get(key) ?? { year: d.getUTCFullYear(), month: d.getUTCMonth(), days: new Map() };
      entry.days.set(d.getUTCDate(), [...(entry.days.get(d.getUTCDate()) ?? []), i]);
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
  }, [versions]);

  const viewBtn = (key: 'timeline' | 'calendar', label: string) => (
    <button
      type="button"
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={`px-4 py-1.5 rounded-full text-11 tracking-[0.25em] uppercase font-sans transition-colors ${
        view === key ? 'bg-amber-200 text-black' : 'text-white/55 hover:text-white border border-white/15'
      }`}
      style={{ fontWeight: 600 }}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto" dir={isHebrew ? 'rtl' : 'ltr'} lang={lang}>
      <div className="mb-10 flex items-center gap-2">
        {viewBtn('timeline', isHebrew ? 'ציר זמן' : 'Timeline')}
        {viewBtn('calendar', isHebrew ? 'לוח שנה' : 'Calendar')}
      </div>

      {view === 'calendar' && (
        <div className="space-y-12">
          {months.map((m) => {
            const first = new Date(Date.UTC(m.year, m.month, 1));
            const startPad = first.getUTCDay();
            const daysInMonth = new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate();
            const monthName = (isHebrew ? MONTHS_HE : MONTHS_EN)[m.month];
            return (
              <section key={`${m.year}-${m.month}`}>
                <h2 className="text-white text-xl mb-4 font-serif" style={{ fontWeight: 500 }}>
                  {monthName} {m.year}
                </h2>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {(isHebrew ? DAYS_HE : DAYS_EN).map((d, i) => (
                    <span key={i} className="pb-2 text-white/40 text-10 tracking-widest uppercase font-sans">{d}</span>
                  ))}
                  {Array.from({ length: startPad }).map((_, i) => (
                    <span key={`pad-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const releases = m.days.get(day);
                    if (!releases) {
                      return (
                        <span key={day} className="grid h-11 place-items-center rounded-xl text-white/30 text-sm font-sans">{day}</span>
                      );
                    }
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => jumpToVersion(releases[0]!)}
                        title={releases.map((ri) => versions[ri]?.date ?? versions[ri]?.version).join(' · ')}
                        className="grid h-11 place-items-center rounded-xl border border-amber-200/50 bg-amber-200/10 text-amber-100 text-sm font-sans transition-colors hover:bg-amber-200/25"
                        style={{ fontWeight: 600 }}
                      >
                        <span>{day}</span>
                        <span className="-mt-1 flex gap-0.5" aria-hidden>
                          {releases.slice(0, 3).map((_, ri) => (
                            <span key={ri} className="h-1 w-1 rounded-full bg-amber-200" />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="text-white/40 text-12 font-sans">
            {isHebrew ? 'לחיצה על יום מסומן פותחת את הגרסה בציר הזמן.' : 'Click a marked day to open that release in the timeline.'}
          </p>
        </div>
      )}

      {view === 'timeline' && (
        <div className="space-y-6">
          {versions.map((v, vi) => {
            const isOpen = open.has(vi);
            return (
              <article key={`${v.version}-${vi}`} id={`release-${vi}`} className="relative rounded-2xl border border-white/10 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => toggle(vi)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-5 text-start"
                >
                  <span className="text-amber-200/70 text-base leading-none font-sans" aria-hidden>
                    {isOpen ? '−' : '+'}
                  </span>
                  <h2 className="text-white text-xl tracking-[0.05em] font-serif" style={{ fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 500 }}>
                    v{v.version}
                  </h2>
                  {v.date && (
                    <span className="min-w-0 flex-1 truncate text-white/55 text-13 font-sans">{v.date}</span>
                  )}
                </button>

                {isOpen && (
                  <div className="px-6 pb-7">
                    {v.intro && (
                      <p className="text-white/55 text-15 mb-8 leading-relaxed" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                        {v.intro}
                      </p>
                    )}

                    <div className="space-y-10">
                      {v.sections.map((section, si) => (
                        <section key={`${section.title}-${si}`}>
                          <h3 className="text-amber-200/85 text-11 tracking-[0.4em] uppercase mb-6 flex items-center gap-3 font-sans">
                            <span>{section.title}</span>
                            <span className="flex-1 h-px bg-amber-200/15" />
                          </h3>

                          <div className="space-y-7">
                            {section.groups.map((group, gi) => (
                              <div key={gi}>
                                {group.heading && (
                                  <h4 className="text-white/90 text-sm mb-3 tracking-wide font-serif" style={{ fontWeight: 500 }}>
                                    {group.heading}
                                  </h4>
                                )}
                                {group.items.length > 0 && (
                                  <ul className="space-y-2">
                                    {group.items.map((item, ii) => (
                                      <li key={ii} className="text-white/65 text-sm leading-relaxed ps-5 relative" style={{ fontFamily: bodyFont }}>
                                        <span className="absolute start-0 top-2 w-1 h-1 rounded-full bg-amber-200/50" />
                                        {renderInline(item).map((part, pi) => {
                                          if (part.kind === 'bold') {
                                            return (
                                              <span key={pi} className="text-white/90 font-serif" style={{ fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 500 }}>
                                                {part.value}
                                              </span>
                                            );
                                          }
                                          if (part.kind === 'code') {
                                            return (
                                              <code key={pi} dir="ltr" className="px-1.5 py-0.5 mx-0.5 rounded bg-amber-200/10 text-amber-100/90 text-xs" style={{ fontFamily: 'var(--font-inter, monospace)' }}>
                                                {part.value}
                                              </code>
                                            );
                                          }
                                          return <span key={pi}>{part.value}</span>;
                                        })}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <footer className="mt-24 pt-12 border-t border-white/10 text-center">
        <p className="text-white/70 text-11 tracking-[0.4em] uppercase font-sans">
          {isHebrew ? 'סוף היומן' : 'End of log'}
        </p>
      </footer>
    </div>
  );
}
