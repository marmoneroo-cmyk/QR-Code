import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseChangelog, type ChangelogVersion } from '@/lib/parseChangelog';
import { AdminShell } from '@/components/ui/AdminShell';
import { ChangelogTimeline } from '@/components/ChangelogTimeline';

export const metadata = {
  title: 'Changelog — Cocktail Menu',
  description: 'A timeline of every feature shipped to the interactive cocktail menu.',
};

async function readParsed(file: string): Promise<ChangelogVersion[]> {
  try {
    const raw = await readFile(path.join(process.cwd(), file), 'utf-8');
    return parseChangelog(raw);
  } catch {
    return [];
  }
}

export default async function ChangelogPage() {
  // Read both languages server-side; the client timeline picks by language.
  const [en, he] = await Promise.all([
    readParsed('CHANGELOG.md'),
    readParsed('CHANGELOG.he.md'),
  ]);

  return (
    <AdminShell
      title="Changelog"
      titleHe="יומן שינויים"
      eyebrow="Build Log"
      eyebrowHe="יומן בנייה"
      active="/changelog"
      subtitle="A timeline of every feature shipped to the platform, in chronological order."
      subtitleHe="ציר זמן של כל תכונה שנוספה לפלטפורמה, בסדר כרונולוגי."
    >
      <ChangelogTimeline en={en} he={he} />
    </AdminShell>
  );
}
