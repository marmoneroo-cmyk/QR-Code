/**
 * Generic restaurant menu importer (CLI).
 *
 * Usage: npm run import:restaurant <url>
 *
 * For UI-based import with AI hero generation, use /admin/import instead.
 *
 * This script reuses src/lib/restaurant-scraper.ts so the CLI + API + admin
 * UI all share the same parser implementation.
 */

import { scrapeRestaurant } from '../src/lib/restaurant-scraper';

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run import:restaurant <url>');
    console.error('Example: npm run import:restaurant https://www.dinerrest.co.il/menus');
    process.exit(1);
  }

  console.error(`Fetching ${url}...`);
  const menu = await scrapeRestaurant(url);

  console.error(`\n✓ Platform: ${menu.platform}`);
  console.error(`✓ Categories: ${menu.categories.length}`);
  console.error(`✓ Total items: ${menu.totalItems}`);
  console.error(`✓ Has product photos: ${menu.hasProductPhotos ? 'YES' : 'NO (text-only menu)'}`);
  console.error('');

  console.log(JSON.stringify(menu, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
