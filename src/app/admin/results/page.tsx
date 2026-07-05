'use client';

import { AdminShell } from '@/components/ui/AdminShell';
import { AdminTabs } from '@/components/ui/AdminTabs';
import { Repeat, Trophy } from 'lucide-react';
import { ClosedLoopPanel } from '@/app/admin/closed-loop/page';
import { WinsPanel } from '@/app/admin/wins/page';

export default function ResultsPage() {
  return (
    <AdminShell
      title="Results"
      titleHe="תוצאות"
      eyebrow="Did the changes work?"
      eyebrowHe="האם השינויים עבדו?"
      active="/admin/results"
      subtitle="Every change you made, measured before-and-after — and the verified wins the platform produced."
      subtitleHe="כל שינוי שעשית, נמדד לפני ואחרי — וההצלחות המאומתות שהמערכת יצרה."
    >
      <AdminTabs
        tabs={[
          { id: 'loop', en: 'Closed Loop', he: 'לולאה סגורה', icon: Repeat, Panel: ClosedLoopPanel },
          { id: 'wins', en: 'Hall of Wins', he: 'אולם ההצלחות', icon: Trophy, Panel: WinsPanel },
        ]}
      />
    </AdminShell>
  );
}
