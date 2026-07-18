import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CocktailExperience } from '@/components/CocktailExperience';
import { findCocktailBySlug, MENU } from '@/data/cocktail';

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
  const description = cocktail.tagline?.en ?? 'An interactive look at what goes into this drink.';
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
  // The full-screen Cocktail Experience is the cocktail page for the whole menu.
  return <CocktailExperience config={config} />;
}
