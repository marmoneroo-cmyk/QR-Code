import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Interactive Cocktail Menu',
    short_name: 'Cocktails',
    description: 'A cinematic interactive 3D cocktail menu experience.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/cocktail/citrus-lime-sour-hero.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['food', 'lifestyle', 'entertainment'],
  };
}
