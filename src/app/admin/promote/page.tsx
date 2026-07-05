'use client';

import { AdminShell } from '@/components/ui/AdminShell';
import { AdminTabs } from '@/components/ui/AdminTabs';
import { Tag, SlidersHorizontal, Link2 } from 'lucide-react';
import { PromotionsPanel } from '@/app/admin/promotions/page';
import { ExperiencePanel } from '@/app/admin/experience/page';
import { RecommendationsPanel } from '@/app/admin/recommendations/page';

export default function PromotePage() {
  return (
    <AdminShell
      title="Promotion"
      titleHe="קידום"
      eyebrow="Make a dish stand out"
      eyebrowHe="להבליט מנה"
      active="/admin/promote"
      subtitle="Discounts, badges and pairings — every lever for pushing a dish in front of more guests."
      subtitleHe="הנחות, תגים והמלצות — כל הכלים להבליט מנה מול יותר אורחים."
    >
      <AdminTabs
        tabs={[
          { id: 'promos', en: 'Promotions', he: 'מבצעים', icon: Tag, Panel: PromotionsPanel },
          { id: 'experience', en: 'Experience', he: 'חוויה', icon: SlidersHorizontal, Panel: ExperiencePanel },
          { id: 'pairings', en: 'Pairings', he: 'הוזמנו יחד', icon: Link2, Panel: RecommendationsPanel },
        ]}
      />
    </AdminShell>
  );
}
