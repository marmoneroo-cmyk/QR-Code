import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CocktailSceneClient } from '@/components/CocktailSceneClient';
import { CocktailExperience } from '@/components/CocktailExperience';
import { findCocktailBySlug, MENU } from '@/data/cocktail';

/**
 * Prototype gate: the new full-screen "Cocktail Experience" runs ONLY for these
 * slugs while we evaluate it. Everything else keeps the existing 3D scene.
 * Roll out by adding slugs (or removing the gate entirely).
 */
const EXPERIENCE_SLUGS = new Set(['diner-aperol-spritz']);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return MENU.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cocktail = findCocktailBySlug(slug);
  if (!cocktail) {
    return { title: 'Cocktail not found' };
  }
  const title = cocktail.title.en;
  const description = cocktail.tagline?.en ?? 'An interactive 3D cocktail breakdown.';
  return {
    title: `${title} — Interactive Menu`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CocktailPage({ params }: PageProps) {
  const { slug } = await params;
  const config = findCocktailBySlug(slug);
  if (!config) {
    notFound();
  }
  if (EXPERIENCE_SLUGS.has(config.slug)) {
    return <CocktailExperience config={config} />;
  }
  return <CocktailSceneClient config={config} />;
}
