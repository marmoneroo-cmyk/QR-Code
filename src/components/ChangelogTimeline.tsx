'use client';

import { renderInline, type ChangelogVersion } from '@/lib/parseChangelog';
import { useLang } from '@/lib/useLang';

const body = 'var(--font-garamond, serif)';
const heBody = 'var(--font-heebo, sans-serif)';

interface ChangelogTimelineProps {
  en: ChangelogVersion[];
  he: ChangelogVersion[];
}

/**
 * Renders the changelog in the active language. The server passes both the
 * English (CHANGELOG.md) and Hebrew (CHANGELOG.he.md) parsed timelines; this
 * client component picks one via the global language and lays it out RTL when
 * Hebrew. Falls back to English if the Hebrew file is missing/empty.
 */
export function ChangelogTimeline({ en, he }: ChangelogTimelineProps) {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const versions = isHebrew && he.length > 0 ? he : en;
  const bodyFont = isHebrew ? heBody : body;

  return (
    <div className="max-w-3xl mx-auto space-y-20" dir={isHebrew ? 'rtl' : 'ltr'} lang={lang}>
      {versions.map((v) => (
        <article key={v.version} className="relative">
          <div className="flex items-baseline gap-4 mb-3">
            <h2 className="text-white text-3xl tracking-[0.05em] font-serif" style={{ fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 500 }}>
              v{v.version}
            </h2>
            {v.date && (
              <span className="text-amber-200/60 text-xs tracking-[0.3em] uppercase font-sans">
                {v.date}
              </span>
            )}
          </div>

          {v.intro && (
            <p className="text-white/55 text-15 mb-8 leading-relaxed" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
              {v.intro}
            </p>
          )}

          <div className="space-y-10">
            {v.sections.map((section) => (
              <section key={section.title}>
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
        </article>
      ))}

      <footer className="mt-24 pt-12 border-t border-white/10 text-center">
        <p className="text-white/70 text-11 tracking-[0.4em] uppercase font-sans">
          {isHebrew ? 'סוף היומן' : 'End of log'}
        </p>
      </footer>
    </div>
  );
}
