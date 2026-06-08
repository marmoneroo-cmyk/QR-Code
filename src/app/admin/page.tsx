'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { CATEGORY_LABEL, MENU, getAccent } from '@/data/cocktail';
import { useDrafts } from '@/lib/useDrafts';
import { useLang } from '@/lib/useLang';
import { BulkBreakdownButton } from '@/components/admin/BulkBreakdownButton';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage } from '@/components/ui/dataviz';
import { Stagger, staggerItem } from '@/components/ui/motion';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const heSerif = 'var(--font-frank-ruhl, serif)';
const body = 'var(--font-garamond, serif)';
const heBody = 'var(--font-heebo, sans-serif)';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h2 className="text-amber-200/85 text-[11px] tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
        {children}
      </h2>
      <span className="flex-1 h-px bg-amber-200/12" />
    </div>
  );
}

interface DraftCardProps {
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  dragLabel: string;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}

/**
 * A single draggable DRAFT card. The whole card is the drop zone, but dragging
 * is initiated ONLY from the GripVertical handle (gated by `canDrag`) so the
 * inner Preview/Edit/Copy/Delete controls stay fully clickable. Reorder logic
 * lives in the parent via the on* callbacks. Published cards do not use this.
 */
function DraftCard({
  index,
  isDragging,
  isDropTarget,
  dragLabel,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}: DraftCardProps) {
  const [canDrag, setCanDrag] = useState(false);

  return (
    <motion.div
      draggable={canDrag}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.06 }}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={() => {
        setCanDrag(false);
        onDragEnd();
      }}
      className={`group relative rounded-2xl border bg-gradient-to-b from-zinc-900/80 to-black p-6 ps-11 transition-all ${
        isDragging
          ? 'border-amber-200/40 opacity-60'
          : isDropTarget
            ? 'border-amber-200/70 ring-1 ring-amber-200/40'
            : 'border-white/10 hover:border-amber-200/30'
      }`}
    >
      <button
        type="button"
        aria-label={dragLabel}
        title={dragLabel}
        onPointerDown={() => setCanDrag(true)}
        onPointerUp={() => setCanDrag(false)}
        onPointerLeave={() => setCanDrag(false)}
        className="absolute start-1.5 top-1/2 -translate-y-1/2 flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded-md text-white/25 transition-colors hover:text-amber-200/80 active:cursor-grabbing"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      {children}
    </motion.div>
  );
}

export default function AdminPage() {
  const { drafts, hydrated, remove, reorderDrafts } = useDrafts();
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const titleFont = isHebrew ? heSerif : serif;
  const bodyFont = isHebrew ? heBody : body;
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  // Drag-to-reorder (drafts only). dragIndex = card being dragged;
  // overIndex = card currently hovered as the drop target (for the indicator).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) reorderDrafts(dragIndex, toIndex);
    endDrag();
  };

  const t = (en: string, he: string) => (isHebrew ? he : en);

  const copyAllDrafts = async () => {
    const clean = drafts.map(({ draftCreatedAt: _c, draftUpdatedAt: _u, ...rest }) => rest);
    try {
      await navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      alert(t('Clipboard copy failed.', 'העתקה ללוח נכשלה.'));
    }
  };

  return (
    <AdminShell
      title="Menu Composer"
      titleHe="עורך התפריט"
      eyebrowHe="ניהול מסעדה"
      active="/admin"
      subtitle="Manage your menu. Drafts live in your browser only — perfect for previewing new items before they go live."
      subtitleHe="נהל את התפריט. הטיוטות נשמרות בדפדפן שלך בלבד — מושלם לתצוגה מקדימה של פריטים לפני שהם עולים לאוויר."
      actions={
        <>
          {hydrated && drafts.length > 0 && (
            <button
              type="button"
              onClick={copyAllDrafts}
              className="px-5 py-2.5 rounded-full border border-white/15 text-white/70 hover:text-amber-100 hover:border-amber-200/50 transition-colors text-[10px] tracking-[0.3em] uppercase"
              style={{ fontFamily: sans }}
            >
              {copiedAll ? t('Copied!', 'הועתק!') : t('Export JSON', 'ייצוא JSON')}
            </button>
          )}
          <Link
            href="/admin/new"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-amber-200 text-black hover:bg-amber-100 transition-colors text-[11px] tracking-[0.25em] uppercase"
            style={{ fontFamily: sans, fontWeight: 600 }}
          >
            {t('+ New Cocktail', '+ קוקטייל חדש')}
          </Link>
        </>
      }
    >
      <SectionLabel>{t('Drafts', 'טיוטות')} ({hydrated ? drafts.length : '—'})</SectionLabel>

      {hydrated && drafts.length > 0 && (
        <div className="mb-8">
          <BulkBreakdownButton />
        </div>
      )}

      {hydrated && drafts.length === 0 ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center mb-16">
          <p className="text-white/55 text-lg mb-4" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
            {t('No drafts yet.', 'אין טיוטות עדיין.')}
          </p>
          <Link
            href="/admin/new"
            className="text-amber-200/90 hover:text-amber-100 transition-colors text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: sans }}
          >
            {t('Create your first cocktail →', '← צור את הקוקטייל הראשון שלך')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {drafts.map((draft, i) => (
            <DraftCard
              key={draft.slug}
              index={i}
              isDragging={dragIndex === i}
              isDropTarget={overIndex === i && dragIndex !== null && dragIndex !== i}
              onDragStart={() => {
                setDragIndex(i);
                setOverIndex(i);
              }}
              onDragOver={() => setOverIndex(i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={endDrag}
              dragLabel={t(
                `Reorder draft ${draft.title[lang] || draft.title.en || 'untitled'}`,
                `שינוי סדר הטיוטה ${draft.title[lang] || draft.title.en || 'ללא שם'}`
              )}
            >
              {draft.heroImage && (
                <GlassImage
                  src={draft.heroImage}
                  accent={getAccent(draft.slug)}
                  className="w-full h-40 mb-4 transition-transform duration-300 group-hover:scale-[1.04]"
                />
              )}
              <h3 className="text-white text-xl mb-1" style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                {draft.title[lang] || draft.title.en || t('Untitled', 'ללא שם')}
              </h3>
              <p className="text-amber-200/60 text-[10px] tracking-[0.3em] uppercase mb-3">
                {CATEGORY_LABEL[draft.category][lang]}
              </p>
              {draft.tagline?.[lang] && (
                <p className="text-white/50 text-sm mb-4" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                  {draft.tagline[lang]}
                </p>
              )}
              <div className="flex items-center gap-3 pt-3 border-t border-white/[0.08] flex-wrap">
                <Link href={`/drafts/${draft.slug}`} className="text-amber-200/80 hover:text-amber-100 transition-colors text-[10px] tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>
                  {t('Preview', 'תצוגה')}
                </Link>
                <Link href={`/admin/${draft.slug}/edit`} className="text-amber-200/80 hover:text-amber-100 transition-colors text-[10px] tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>
                  {t('Edit', 'עריכה')}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    const { draftCreatedAt: _c, draftUpdatedAt: _u, ...clean } = draft;
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
                      setCopiedSlug(draft.slug);
                      window.setTimeout(() => setCopiedSlug((s) => (s === draft.slug ? null : s)), 1500);
                    } catch {
                      alert(t('Clipboard copy failed.', 'העתקה ללוח נכשלה.'));
                    }
                  }}
                  className="text-amber-200/80 hover:text-amber-100 transition-colors text-[10px] tracking-[0.3em] uppercase"
                  style={{ fontFamily: sans }}
                >
                  {copiedSlug === draft.slug ? t('Copied!', 'הועתק!') : t('Copy JSON', 'העתק JSON')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t(`Delete draft "${draft.title[lang] || draft.title.en}"?`, `למחוק את הטיוטה "${draft.title[lang] || draft.title.en}"?`)))
                      remove(draft.slug);
                  }}
                  className="text-rose-300/60 hover:text-rose-300 transition-colors text-[10px] tracking-[0.3em] uppercase ms-auto"
                  style={{ fontFamily: sans }}
                >
                  {t('Delete', 'מחיקה')}
                </button>
              </div>
            </DraftCard>
          ))}
        </div>
      )}

      <SectionLabel>{t('Published', 'פורסמו')} ({MENU.length})</SectionLabel>
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {MENU.map((cocktail) => (
          <motion.div key={cocktail.slug} variants={staggerItem} className="group rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-6 transition-colors hover:border-amber-200/25">
            {cocktail.heroImage && (
              <GlassImage
                src={cocktail.heroImage}
                accent={getAccent(cocktail.slug)}
                className="w-full h-40 mb-4 transition-transform duration-300 group-hover:scale-[1.04]"
              />
            )}
            <h3 className="text-white text-xl mb-1" style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
              {cocktail.title[lang]}
            </h3>
            <p className="text-amber-200/60 text-[10px] tracking-[0.3em] uppercase mb-3">
              {CATEGORY_LABEL[cocktail.category][lang]}
            </p>
            {cocktail.tagline && (
              <p className="text-white/50 text-sm" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                {cocktail.tagline[lang]}
              </p>
            )}
            <p className="text-white/30 text-[10px] tracking-wider uppercase mt-4">{t('Hardcoded · published', 'מובנה · פורסם')}</p>
          </motion.div>
        ))}
      </Stagger>
    </AdminShell>
  );
}
