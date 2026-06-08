'use client';

import dynamic from 'next/dynamic';
import type { CocktailConfig } from '@/data/cocktail';

const CocktailScene = dynamic(
  () => import('./CocktailScene').then((mod) => mod.CocktailScene),
  { ssr: false }
);

interface CocktailSceneClientProps {
  config: CocktailConfig;
}

export function CocktailSceneClient({ config }: CocktailSceneClientProps) {
  return <CocktailScene config={config} />;
}
