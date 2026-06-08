'use client';

import { useRouter } from 'next/navigation';
import { CocktailForm } from '@/components/admin/CocktailForm';
import { AdminShell } from '@/components/ui/AdminShell';

export default function NewCocktailPage() {
  const router = useRouter();

  return (
    <AdminShell
      title="Compose a new cocktail"
      titleHe="הרכבת קוקטייל חדש"
      eyebrow="New Cocktail"
      eyebrowHe="קוקטייל חדש"
      active="/admin"
      subtitle="Fill in the details, generate the hero image with AI, optionally render a unique 3D breakdown, and the cocktail appears in the menu instantly."
      subtitleHe="מלא את הפרטים, צור תמונת גיבור עם AI, אופציונלית הצג פירוק תלת-ממדי ייחודי, והקוקטייל מופיע בתפריט מיד."
    >
      <div className="max-w-3xl mx-auto">
        <CocktailForm mode="new" onSaved={() => router.push('/admin')} />
      </div>
    </AdminShell>
  );
}
