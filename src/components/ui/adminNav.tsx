import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Lightbulb,
  Repeat,
  Tag,
  SlidersHorizontal,
  Receipt,
  BarChart3,
  FlaskConical,
  Users,
  Link2,
  PencilLine,
  Upload,
  QrCode,
  Printer,
  MonitorSmartphone,
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
  items: AdminNavItem[];
}

/** Single source of truth for the admin sections — used by the launcher grid + top bar. */
export const ADMIN_GROUPS: AdminNavGroup[] = [
  {
    en: 'Act',
    he: 'פעולה',
    items: [
      { href: '/admin/revenue', en: 'Revenue', he: 'הכנסות', descEn: 'How much money the system makes you', descHe: 'כמה כסף המערכת מייצרת', Icon: Banknote },
      { href: '/admin/opportunities', en: 'Opportunities', he: 'הזדמנויות', descEn: 'What to do today', descHe: 'מה לעשות היום', Icon: Lightbulb },
      { href: '/admin/closed-loop', en: 'Closed Loop', he: 'לולאה סגורה', descEn: 'Did changes work?', descHe: 'האם השינויים עבדו?', Icon: Repeat },
      { href: '/admin/promotions', en: 'Promotions', he: 'מבצעים', descEn: 'Discounts & happy hour', descHe: 'הנחות ושעה שמחה', Icon: Tag },
      { href: '/admin/experience', en: 'Experience', he: 'חוויה', descEn: 'Badges & modules', descHe: 'תגים ומודולים', Icon: SlidersHorizontal },
      { href: '/admin/sales', en: 'Sales', he: 'מכירות', descEn: 'Import POS sales', descHe: 'ייבוא מכירות', Icon: Receipt },
    ],
  },
  {
    en: 'Understand',
    he: 'הבנה',
    items: [
      { href: '/admin/analytics', en: 'Analytics', he: 'אנליטיקה', descEn: 'Views · conversion · revenue', descHe: 'צפיות · המרה · הכנסה', Icon: BarChart3 },
      { href: '/admin/menu-analysis', en: 'Menu Analysis', he: 'ניתוח תפריט', descEn: 'Why a drink behaves so', descHe: 'למה משקה מתנהג כך', Icon: FlaskConical },
      { href: '/admin/guests', en: 'Guests', he: 'אורחים', descEn: 'Tables & journeys', descHe: 'שולחנות ומסעות', Icon: Users },
      { href: '/admin/recommendations', en: 'Pairings', he: 'המלצות', descEn: 'Guests also viewed', descHe: 'אורחים צפו גם ב', Icon: Link2 },
    ],
  },
  {
    en: 'Menu & Setup',
    he: 'תפריט והקמה',
    items: [
      { href: '/admin', en: 'Composer', he: 'עורך', descEn: 'Create & edit cocktails', descHe: 'יצירה ועריכת קוקטיילים', Icon: PencilLine },
      { href: '/admin/import', en: 'Import', he: 'ייבוא', descEn: 'Import a restaurant', descHe: 'ייבוא מסעדה', Icon: Upload },
      { href: '/admin/qr', en: 'QR Codes', he: 'קודי QR', descEn: 'Per-table QR codes', descHe: 'קודי QR לשולחנות', Icon: QrCode },
      { href: '/admin/print', en: 'Print Kit', he: 'הדפסה', descEn: 'Printable menu kit', descHe: 'ערכת הדפסה', Icon: Printer },
      { href: '/kiosk', en: 'Kiosk', he: 'קיוסק', descEn: 'Kiosk display mode', descHe: 'מצב קיוסק', Icon: MonitorSmartphone },
    ],
  },
  {
    en: 'Advanced',
    he: 'מתקדם',
    items: [
      { href: '/admin/executive', en: 'Executive', he: 'מנהלים', descEn: 'Executive summary', descHe: 'תקציר מנהלים', Icon: Briefcase },
      { href: '/admin/experiments', en: 'A/B Tests', he: 'בדיקות A/B', descEn: 'Experiments', descHe: 'ניסויים', Icon: Split },
      { href: '/admin/events', en: 'Inspector', he: 'בוחן', descEn: 'Raw event inspector', descHe: 'בוחן אירועים גולמיים', Icon: Search },
      { href: '/admin/signals', en: 'Signals', he: 'סיגנלים', descEn: 'Data-quality gate', descHe: 'שער איכות נתונים', Icon: Activity },
      { href: '/changelog', en: 'Build Log', he: 'יומן', descEn: 'Shipped changes', descHe: 'יומן שינויים', Icon: ScrollText },
    ],
  },
];
