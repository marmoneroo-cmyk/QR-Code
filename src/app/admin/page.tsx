'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { CATEGORY_LABEL, MENU, getAccent } from '@/data/cocktail';
import { useDrafts } from '@/lib/useDrafts';
import { useMenuOrder } from '@/lib/useMenuOrder';
import { useLang } from '@/lib/useLang';
import { BulkBreakdownButton } from '@/components/admin/BulkBreakdownButton';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel } from '@/components/ui/dataviz';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const heSerif = 'var(--font-frank-ruhl, serif)';
const body = 'var(--font-garamond, serif)';
const heBody = 'var(--font-heebo, sans-serif)';

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
      className={`group relative rounded-2xl p-6 ps-11 transition-all ${
        isDragging
          ? 'border border-amber-200/40 bg-white/[0.03] opacity-60'
          : isDropTarget
            ? 'border border-amber-200/70 bg-white/[0.03] ring-1 ring-amber-200/40'
            : 'glass-panel hover:border-amber-200/30'
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
  const { order, setOrder, apply: applyMenuOrder } = useMenuOrder();
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
  const [pubDragIndex, setPubDragIndex] = useState<number | null>(null);
  const [pubOverIndex, setPubOverIndex] = useState<number | null>(null);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) reorderDrafts(dragIndex, toIndex);
    endDrag();
  };

  // Published-menu reorder — persisted via useMenuOrder and reflected on the guest menu.
  const publishedList = applyMenuOrder(MENU);
  const endPubDrag = () => {
    setPubDragIndex(null);
    setPubOverIndex(null);
  };
  const handlePubDrop = (toIndex: number) => {
    if (pubDragIndex !== null && pubDragIndex !== toIndex) {
      const next = [...publishedList];
      const [moved] = next.splice(pubDragIndex, 1);
      next.splice(toIndex, 0, moved);
      setOrder(next.map((c) => c.slug));
    }
    endPubDrag();
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
              className="group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-xs tracking-[0.16em] uppercase text-white/80 transition-colors hover:border-amber-200/40 hover:text-amber-100"
              style={{ fontFamily: sans, fontWeight: 600 }}
            >
              {copiedAll ? t('Copied!', 'הועתק!') : t('Export JSON', 'ייצוא JSON')}
            </button>
          )}
          <Link
            href="/admin/new"
            className="group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-13 tracking-[0.16em] uppercase text-black transition-shadow"
            style={{
              fontFamily: sans,
              fontWeight: 700,
              background: 'linear-gradient(105deg, var(--champagne-bright), var(--champagne) 55%, var(--champagne-deep))',
              boxShadow: '0 10px 34px rgba(232, 201, 135, 0.26)',
            }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 -start-1/2 w-1/3 -skew-x-12 opacity-0 transition-all duration-700 group-hover:start-[120%] group-hover:opacity-60"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
            />
            <span className="relative z-10 inline-flex items-center gap-2">{t('+ New Cocktail', '+ קוקטייל חדש')}</span>
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
        <div className="glass-panel rounded-2xl p-12 text-center mb-16">
          <p className="text-white/55 text-lg mb-4" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
            {t('No drafts yet.', 'אין טיוטות עדיין.')}
          </p>
          <Link
            href="/admin/new"
            className="text-amber-200/90 hover:text-amber-100 transition-colors text-11 tracking-[0.3em] uppercase"
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
                  className="w-full h-48 mb-4 transition-transform duration-300 group-hover:scale-[1.04]"
                />
              )}
              <h3 className="text-white text-xl mb-1" style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                {draft.title[lang] || draft.title.en || t('Untitled', 'ללא שם')}
              </h3>
              <p className="text-amber-200/60 text-10 tracking-[0.3em] uppercase mb-3">
                {CATEGORY_LABEL[draft.category][lang]}
              </p>
              {draft.tagline?.[lang] && (
                <p className="text-white/50 text-sm mb-4" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                  {draft.tagline[lang]}
                </p>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-white/[0.08] flex-wrap">
                <Link
                  href={`/drafts/${draft.slug}`}
                  className="inline-flex items-center rounded-full border border-white/15 px-3.5 py-1.5 text-amber-200/80 hover:text-amber-100 hover:border-amber-200/40 transition-colors text-10 tracking-[0.3em] uppercase"
                  style={{ fontFamily: sans }}
                >
                  {t('Preview', 'תצוגה')}
                </Link>
                <Link
                  href={`/admin/${draft.slug}/edit`}
                  className="inline-flex items-center rounded-full border border-white/15 px-3.5 py-1.5 text-amber-200/80 hover:text-amber-100 hover:border-amber-200/40 transition-colors text-10 tracking-[0.3em] uppercase"
                  style={{ fontFamily: sans }}
                >
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
                  className="inline-flex items-center rounded-full border border-white/15 px-3.5 py-1.5 text-amber-200/80 hover:text-amber-100 hover:border-amber-200/40 transition-colors text-10 tracking-[0.3em] uppercase"
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
                  className="inline-flex items-center rounded-full border border-rose-300/20 px-3.5 py-1.5 text-rose-300/70 hover:text-rose-300 hover:border-rose-300/40 transition-colors text-10 tracking-[0.3em] uppercase ms-auto"
                  style={{ fontFamily: sans }}
                >
                  {t('Delete', 'מחיקה')}
                </button>
              </div>
            </DraftCard>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-amber-200/85 text-11 tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
          {t('Published', 'פורסמו')} ({MENU.length})
        </h2>
        {order.length > 0 && (
          <button
            type="button"
            onClick={() => setOrder([])}
            className="text-white/45 hover:text-amber-100 transition-colors text-9 tracking-[0.25em] uppercase"
            style={{ fontFamily: sans }}
          >
            {t('Custom order · Reset', 'סדר מותאם · אפס')}
          </button>
        )}
        <span className="flex-1 h-px bg-amber-200/12" />
      </div>
      <p className="text-white/70 text-11 mb-6" style={{ fontFamily: sans }}>
        {t(
          'Drag the handle to set how items appear on the guest menu (saved on this device).',
          'גררו מהידית כדי לקבוע את סדר הופעת הפריטים בתפריט הסועד (נשמר במכשיר זה).'
        )}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {publishedList.map((cocktail, i) => (
          <DraftCard
            key={cocktail.slug}
            index={i}
            isDragging={pubDragIndex === i}
            isDropTarget={pubOverIndex === i && pubDragIndex !== null && pubDragIndex !== i}
            onDragStart={() => {
              setPubDragIndex(i);
              setPubOverIndex(i);
            }}
            onDragOver={() => setPubOverIndex(i)}
            onDrop={() => handlePubDrop(i)}
            onDragEnd={endPubDrag}
            dragLabel={t(`Reorder ${cocktail.title.en}`, `שינוי סדר ${cocktail.title.he}`)}
          >
            {cocktail.heroImage && (
              <GlassImage
                src={cocktail.heroImage}
                accent={getAccent(cocktail.slug)}
                className="w-full h-48 mb-4 transition-transform duration-300 group-hover:scale-[1.04]"
              />
            )}
            <h3 className="text-white text-xl mb-1" style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
              {cocktail.title[lang]}
            </h3>
            <p className="text-amber-200/60 text-10 tracking-[0.3em] uppercase mb-3">
              {CATEGORY_LABEL[cocktail.category][lang]}
            </p>
            {cocktail.tagline && (
              <p className="text-white/50 text-sm" style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                {cocktail.tagline[lang]}
              </p>
            )}
            <p className="text-white/70 text-10 tracking-wider uppercase mt-4">{t('Published', 'פורסם')}</p>
          </DraftCard>
        ))}
      </div>
    </AdminShell>
  );
}
