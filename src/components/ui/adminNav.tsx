import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Zap,
  Trophy,
  PencilLine,
  Tag,
  Upload,
  BarChart3,
  FlaskConical,
  Users,
  Wrench,
  Briefcase,
  Split,
  Search,
  Activity,
  ScrollText,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  en: string;
  he: string;
  descEn: string;
  descHe: string;
  Icon: LucideIcon;
}

export interface AdminNavGroup {
  en: string;
  he: string;
  /** Hidden behind the launcher's "Advanced mode" toggle (expert/operator surfaces). */
  advanced?: boolean;
  items: AdminNavItem[];
}

/**
 * Single source of truth for admin navigation — used by the launcher grid + top bar.
 *
 * Consolidated (2026-07) from ~23 destinations to 6 primary + Advanced, organised by
 * the owner's four questions (What's the state? · What to do? · Did it work? · Manage).
 * Related screens are now grouped INTO destinations as tabs (Today, Results, Promotion,
 * Tools, Menu Analysis, Guests). Every original route still resolves — direct links and
 * bookmarks keep working — they're just no longer separate launcher entries.
 */
export const ADMIN_GROUPS: AdminNavGroup[] = [
  {
    en: 'Act',
    he: 'פעולה',
    items: [
      { href: '/admin/home', en: 'Home', he: 'בית', descEn: 'Your restaurant at a glance', descHe: 'המסעדה שלך במבט אחד', Icon: Home },
      { href: '/admin/today', en: 'Today', he: 'היום', descEn: "Tonight's move · actions · opportunities", descHe: 'המהלך של הערב · פעולות · הזדמנויות', Icon: Zap },
      { href: '/admin/results', en: 'Results', he: 'תוצאות', descEn: 'Did your changes work? · wins', descHe: 'האם השינויים עבדו? · הצלחות', Icon: Trophy },
    ],
  },
  {
    en: 'Menu & Promotion',
    he: 'תפריט וקידום',
    items: [
      { href: '/admin', en: 'Composer', he: 'עורך התפריט', descEn: 'Create & edit menu items', descHe: 'יצירה ועריכת פריטי תפריט', Icon: PencilLine },
      { href: '/admin/promote', en: 'Promotion', he: 'קידום', descEn: 'Discounts · badges · pairings', descHe: 'הנחות · תגים · המלצות', Icon: Tag },
      { href: '/admin/import', en: 'Import', he: 'ייבוא', descEn: 'Import a restaurant menu', descHe: 'ייבוא תפריט מסעדה', Icon: Upload },
    ],
  },
  {
    en: 'Insights',
    he: 'תובנות',
    items: [
      { href: '/admin/analytics', en: 'Analytics', he: 'אנליטיקה', descEn: 'Views · orders · demand', descHe: 'צפיות · הזמנות · ביקוש', Icon: BarChart3 },
      { href: '/admin/menu-analysis', en: 'Menu Analysis', he: 'ניתוח תפריט', descEn: 'Why a dish behaves so', descHe: 'למה מנה מתנהגת כך', Icon: FlaskConical },
      { href: '/admin/guests', en: 'Guests', he: 'אורחים', descEn: 'Tables · journeys · guests', descHe: 'שולחנות · מסעות · אורחים', Icon: Users },
    ],
  },
  {
    en: 'Tools',
    he: 'כלים',
    items: [
      { href: '/admin/tools', en: 'Tools', he: 'כלים', descEn: 'QR · print · kiosk · sales import', descHe: 'QR · הדפסה · קיוסק · ייבוא מכירות', Icon: Wrench },
    ],
  },
  {
    en: 'Advanced',
    he: 'מתקדם',
    advanced: true,
    items: [
      { href: '/admin/executive', en: 'Executive', he: 'מנהלים', descEn: 'Executive summary', descHe: 'תקציר מנהלים', Icon: Briefcase },
      { href: '/admin/experiments', en: 'A/B Tests', he: 'בדיקות A/B', descEn: 'Experiments', descHe: 'ניסויים', Icon: Split },
      { href: '/admin/events', en: 'Inspector', he: 'בוחן', descEn: 'Raw event inspector', descHe: 'בוחן אירועים גולמיים', Icon: Search },
      { href: '/admin/signals', en: 'Signals', he: 'סיגנלים', descEn: 'Data-quality gate', descHe: 'שער איכות נתונים', Icon: Activity },
      { href: '/changelog', en: 'Build Log', he: 'יומן', descEn: 'Shipped changes', descHe: 'יומן שינויים', Icon: ScrollText },
    ],
  },
];
