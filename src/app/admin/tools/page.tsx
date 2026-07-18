'use client';

import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { AdminShell } from '@/components/ui/AdminShell';
import { AdminTabs } from '@/components/ui/AdminTabs';
import { QrCode, Receipt, Printer, MonitorSmartphone } from 'lucide-react';
import { QrPanel } from '@/app/admin/qr/page';
import { SalesPanel } from '@/app/admin/sales/page';

export default function ToolsPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';

  return (
    <AdminShell
      title="Tools"
      titleHe="כלים"
      eyebrow="Physical & operational"
      eyebrowHe="פיזי ותפעולי"
      active="/admin/tools"
      subtitle="QR codes, sales import, the print kit and kiosk mode — the practical tools that connect the menu to your floor."
      subtitleHe="קודי QR, ייבוא מכירות, ערכת ההדפסה ומצב קיוסק — הכלים המעשיים שמחברים את התפריט לרצפה."
    >
      <AdminTabs
        tabs={[
          { id: 'qr', en: 'QR Codes', he: 'קודי QR', icon: QrCode, Panel: QrPanel },
          { id: 'sales', en: 'Sales Import', he: 'ייבוא מכירות', icon: Receipt, Panel: SalesPanel },
        ]}
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2" dir={isHe ? 'rtl' : 'ltr'}>
        {[
          {
            href: '/admin/print',
            Icon: Printer,
            en: 'Print Kit',
            he: 'ערכת הדפסה',
            dEn: 'Printable table-tent menu cards',
            dHe: 'כרטיסי תפריט להדפסה לשולחן',
          },
          {
            href: '/kiosk',
            Icon: MonitorSmartphone,
            en: 'Kiosk Mode',
            he: 'מצב קיוסק',
            dEn: 'Full-screen entrance display',
            dHe: 'תצוגת כניסה במסך מלא',
          },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="glass-panel group flex items-center gap-4 rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-amber-200/35"
          >
            <span className="grid place-items-center w-11 h-11 rounded-xl border border-white/10 text-amber-200/80 group-hover:text-amber-100">
              <c.Icon size={19} strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-white/90 text-sm"
                style={{ fontFamily: 'var(--font-inter, sans-serif)', fontWeight: 500 }}
              >
                {isHe ? c.he : c.en}
              </span>
              <span className="block text-white/45 text-xs mt-0.5" style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>
                {isHe ? c.dHe : c.dEn}
              </span>
            </span>
            <span
              aria-hidden
              className="text-amber-200/50 group-hover:text-amber-200 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            >
              {isHe ? '←' : '→'}
            </span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
