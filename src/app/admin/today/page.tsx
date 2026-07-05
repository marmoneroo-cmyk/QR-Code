'use client';

import { AdminShell } from '@/components/ui/AdminShell';
import { AdminTabs } from '@/components/ui/AdminTabs';
import { ClipboardList, Zap, Lightbulb } from 'lucide-react';
import { CoachPanel } from '@/app/admin/coach/page';
import { ActionsPanel } from '@/app/admin/actions/page';
import { OpportunitiesPanel } from '@/app/admin/opportunities/page';

export default function TodayPage() {
  return (
    <AdminShell
      title="Today"
      titleHe="היום"
      eyebrow="What should I do today?"
      eyebrowHe="מה כדאי לעשות היום?"
      active="/admin/today"
      subtitle="Tonight's move, the actions to take, and every open opportunity — one place to decide what to do."
      subtitleHe="המהלך של הערב, הפעולות לבצע, וכל ההזדמנויות הפתוחות — מקום אחד להחליט מה לעשות."
    >
      <AdminTabs
        tabs={[
          { id: 'briefing', en: 'Shift Briefing', he: 'תדריך המשמרת', icon: ClipboardList, Panel: CoachPanel },
          { id: 'actions', en: 'Action Center', he: 'מרכז פעולות', icon: Zap, Panel: ActionsPanel },
          { id: 'opportunities', en: 'Opportunities', he: 'הזדמנויות', icon: Lightbulb, Panel: OpportunitiesPanel },
        ]}
      />
    </AdminShell>
  );
}
