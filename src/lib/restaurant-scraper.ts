import { safeFetch } from '@/lib/net/ssrf';
import { readCappedText } from '@/lib/net/bounded';

export type Platform = 'getmood.io' | 'wix' | 'tabit' | 'generic' | 'unknown';

export interface ParsedItem {
  name: string;
  price: string | null;
  desc: string | null;
  image?: string | null;
}

export interface ParsedCategory {
  id: string;
  name: string;
  items: ParsedItem[];
}

export interface ParsedMenu {
  source: string;
  platform: Platform;
  categories: ParsedCategory[];
  totalItems: number;
  hasProductPhotos: boolean;
}

function stripTags(s: string): string {
  return (
    s
      /*
       * Drop <style>/<script> WITH their contents first. Removing only the tags leaves the
       * CSS or JS body behind as text — a real menu produced the item name
       * "לבבות ארטישוק בגריל מנה צמחונית path.veg { fill: #007E17; } …" because the
       * dietary-badge SVGs carry inline <style>. Menus embed those icons per item, so this
       * is the common case, not an edge case.
       */
      .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function detectPlatform(html: string, url: string): Platform {
  if (html.includes('getmood.io')) return 'getmood.io';
  if (/tabit\.cloud|tabit-online|tabit-app/i.test(html) || /tabit\.cloud/i.test(url)) return 'tabit';
  if (/wixstatic\.com|wix\.com|data-hook="menu-/i.test(html)) return 'wix';
  // Generic fallback if we see at least a few h-tags with prices
  const headingCount = [...html.matchAll(/<h[1-6][^>]*>/g)].length;
  const priceCount = [...html.matchAll(/\b\d{1,3}\s*(?:₪|shkalim|NIS|ש"ח)/gi)].length;
  if (headingCount > 5 && priceCount > 3) return 'generic';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// getmood.io parser
// ---------------------------------------------------------------------------

function parseGetmood(html: string): { categories: ParsedCategory[]; hasPhotos: boolean } {
  const navMatches = [...html.matchAll(/<a id="menuModuleNav(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/g)];
  const navMap: Record<string, string> = {};
  navMatches.forEach((m) => {
    navMap[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  });

  const sectionMatches = [...html.matchAll(/id="menuModuleContentPart(\d+)"/g)];
  const sectionBounds = sectionMatches.map((m, i, arr) => ({
    id: m[1],
    start: m.index!,
    end: i + 1 < arr.length ? arr[i + 1].index! : html.length,
  }));

  const categories: ParsedCategory[] = [];
  for (const { id, start, end } of sectionBounds) {
    const section = html.slice(start, end);
    const itemRe = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]{0,800}?)(?=<h3|<\/section|<\/div>\s*<\/div>)/g;
    const items: ParsedItem[] = [];
    for (const m of section.matchAll(itemRe)) {
      const name = stripTags(m[1]);
      const tail = m[2];
      // getmood markup (class-based, stable):
      //   <div class="menuModuleTextItemPrice">96<span class="scr-reader-only">shkalim</span></div>
      //   <div class="menuModuleTextItemDescription">חסה, שבבי בטטה ואיולי כמהין</div>
      const priceMatch =
        tail.match(/menuModuleTextItemPrice[^>]*>\s*(\d+(?:[.,/]\d+)?)/) ||
        tail.match(/(\d+(?:\/\d+)?)\s*(?:shkalim|₪|ש"?ח)/i);
      const price = priceMatch ? priceMatch[1] : null;
      const descMatch =
        tail.match(/menuModuleTextItemDescription[^>]*>([\s\S]*?)(?:<\/div>|$)/) ||
        tail.match(/<p[^>]*>\s*([^<]+?)\s*<\/p>/);
      const desc = descMatch ? stripTags(descMatch[1]).replace(/\s+/g, ' ').trim() || null : null;
      if (!name || name.length < 2 || name.startsWith('*') || /המטבח/.test(name)) continue;
      items.push({ name, price, desc });
    }
    if (items.length > 0) {
      categories.push({ id, name: navMap[id] || `cat-${id}`, items });
    }
  }

  const imgCount = [...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))/gi)].length;
  return { categories, hasPhotos: imgCount > 12 };
}

// ---------------------------------------------------------------------------
// Wix Restaurants parser (uses data-hook attributes which are stable across sites)
// ---------------------------------------------------------------------------

function parseWix(html: string): { categories: ParsedCategory[]; hasPhotos: boolean } {
  const categories: ParsedCategory[] = [];

  // Wix Restaurants v2: <section data-hook="menu-section"> contains a section name + items
  const sectionRe = /<section[^>]+data-hook="menu-section"[^>]*>([\s\S]*?)<\/section>/g;
  let sectionIndex = 0;
  let foundAnySection = false;
  for (const sm of html.matchAll(sectionRe)) {
    foundAnySection = true;
    const block = sm[1];
    const sectionNameMatch = block.match(/data-hook="menu-section-name"[^>]*>([\s\S]*?)</);
    const sectionName = sectionNameMatch ? stripTags(sectionNameMatch[1]) : `Section ${sectionIndex + 1}`;

    const items: ParsedItem[] = [];
    const itemRe = /data-hook="menu-item"[^>]*>([\s\S]*?)(?=data-hook="menu-item"|<\/section)/g;
    for (const im of block.matchAll(itemRe)) {
      const item = im[1];
      const nameMatch = item.match(/data-hook="menu-item-name"[^>]*>([\s\S]*?)</);
      const priceMatch = item.match(/data-hook="menu-item-price"[^>]*>([\s\S]*?)</);
      const descMatch = item.match(/data-hook="menu-item-description"[^>]*>([\s\S]*?)</);
      const imageMatch = item.match(/data-hook="menu-item-image"[^>]*src="([^"]+)"/);
      const name = nameMatch ? stripTags(nameMatch[1]) : '';
      if (!name) continue;
      items.push({
        name,
        price: priceMatch ? stripTags(priceMatch[1]).replace(/[^\d.,/]/g, '') || null : null,
        desc: descMatch ? stripTags(descMatch[1]) || null : null,
        image: imageMatch ? imageMatch[1] : null,
      });
    }
    if (items.length > 0) {
      categories.push({ id: String(sectionIndex), name: sectionName, items });
    }
    sectionIndex++;
  }

  // Some Wix sites use a flatter layout (no menu-section wrapper). Fall back if we found none.
  if (!foundAnySection) {
    const items: ParsedItem[] = [];
    const itemRe = /data-hook="menu-item"[^>]*>([\s\S]*?)(?=data-hook="menu-item"|<\/main|<\/body)/g;
    for (const im of html.matchAll(itemRe)) {
      const item = im[1];
      const nameMatch = item.match(/data-hook="menu-item-name"[^>]*>([\s\S]*?)</);
      const priceMatch = item.match(/data-hook="menu-item-price"[^>]*>([\s\S]*?)</);
      const descMatch = item.match(/data-hook="menu-item-description"[^>]*>([\s\S]*?)</);
      const imageMatch = item.match(/data-hook="menu-item-image"[^>]*src="([^"]+)"/);
      const name = nameMatch ? stripTags(nameMatch[1]) : '';
      if (!name) continue;
      items.push({
        name,
        price: priceMatch ? stripTags(priceMatch[1]).replace(/[^\d.,/]/g, '') || null : null,
        desc: descMatch ? stripTags(descMatch[1]) || null : null,
        image: imageMatch ? imageMatch[1] : null,
      });
    }
    if (items.length > 0) categories.push({ id: '0', name: 'Menu', items });
  }

  const itemsWithImages = categories.flatMap((c) => c.items).filter((it) => it.image).length;
  return { categories, hasPhotos: itemsWithImages > 3 };
}

// ---------------------------------------------------------------------------
// Tabit parser — most Tabit menus are loaded via JS / API, but some embed
// the data as a JSON island. Best effort.
// ---------------------------------------------------------------------------

function parseTabit(html: string): { categories: ParsedCategory[]; hasPhotos: boolean } {
  const categories: ParsedCategory[] = [];

  // Look for an embedded menu JSON (Tabit often uses `window.__APP_DATA__` or similar)
  const jsonMatch = html.match(/window\.__\w+__\s*=\s*(\{[\s\S]*?\});/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const menus = (data.menus ?? data.menu ?? data.restaurant?.menus) as unknown;
      if (Array.isArray(menus)) {
        for (const m of menus) {
          const items = (m.items ?? m.dishes ?? []) as Array<{
            name?: string;
            description?: string;
            price?: number | string;
            image?: string;
          }>;
          const parsed: ParsedItem[] = items
            .filter((i) => i && typeof i.name === 'string')
            .map((i) => ({
              name: String(i.name),
              price: i.price !== undefined ? String(i.price) : null,
              desc: i.description ?? null,
              image: i.image ?? null,
            }));
          if (parsed.length > 0) {
            categories.push({
              id: String(m.id ?? categories.length),
              name: String(m.name ?? `Menu ${categories.length + 1}`),
              items: parsed,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const itemsWithImages = categories.flatMap((c) => c.items).filter((it) => it.image).length;
  return { categories, hasPhotos: itemsWithImages > 3 };
}

// ---------------------------------------------------------------------------
// Generic fallback — finds h-tag items with nearby prices
// ---------------------------------------------------------------------------

function parseGeneric(html: string): { categories: ParsedCategory[]; hasPhotos: boolean } {
  const headRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g;
  const headings = [...html.matchAll(headRe)].map((m) => ({
    level: parseInt(m[1], 10),
    raw: m[2],
    text: stripTags(m[2]),
    idx: m.index!,
  }));

  // Treat the lowest-numbered heading levels as categories, deeper as items
  if (headings.length === 0) return { categories: [], hasPhotos: false };

  const itemLevel = Math.max(...headings.map((h) => h.level)); // deepest level = items
  const categoryLevel = Math.min(...headings.filter((h) => h.level < itemLevel).map((h) => h.level), itemLevel - 1);

  const categories: ParsedCategory[] = [];
  let currentCat: ParsedCategory | null = null;

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    if (h.level === categoryLevel) {
      currentCat = { id: String(categories.length), name: h.text, items: [] };
      categories.push(currentCat);
      continue;
    }
    if (h.level === itemLevel && h.text.length > 1) {
      const next = headings[i + 1]?.idx ?? h.idx + 1500;
      const tail = html.slice(h.idx + h.raw.length, next);
      const priceMatch = tail.match(/(\d+(?:[.,]\d+)?)\s*(?:₪|shkalim|NIS|ש"ח)/i);
      const descMatch = tail.match(/<p[^>]*>\s*([^<]+?)\s*<\/p>/);
      const item: ParsedItem = {
        name: h.text,
        price: priceMatch ? priceMatch[1] : null,
        desc: descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : null,
      };
      if (!currentCat) {
        currentCat = { id: '0', name: 'Menu', items: [] };
        categories.push(currentCat);
      }
      currentCat.items.push(item);
    }
  }

  const cleaned = categories.filter((c) => c.items.length > 0);
  const imgCount = [...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))/gi)].length;
  return { categories: cleaned, hasPhotos: imgCount > 12 };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function scrapeRestaurant(url: string): Promise<ParsedMenu> {
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) {
    target = `https://${target}`;
  }

  // SSRF guard: refuse internal/metadata/private hosts and re-validate every redirect hop.
  const res = await safeFetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0 cocktail-demo-importer' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${target}`);
  }
  // Cap the response body: a passing (public) host can still stream a huge/slow body to
  // exhaust memory. 8 MB is generous for any real menu page.
  const html = await readCappedText(res.body, 8_000_000);
  if (html === null) {
    throw new Error(`response too large for ${target}`);
  }
  const platform = detectPlatform(html, target);

  let parsed: { categories: ParsedCategory[]; hasPhotos: boolean };

  switch (platform) {
    case 'getmood.io':
      parsed = parseGetmood(html);
      break;
    case 'wix':
      parsed = parseWix(html);
      break;
    case 'tabit':
      parsed = parseTabit(html);
      break;
    case 'generic':
      parsed = parseGeneric(html);
      break;
    default:
      throw new Error(
        `Unsupported platform for ${target}. Detected: ${platform}. ` +
          `Add a parser to src/lib/restaurant-scraper.ts.`
      );
  }

  // If platform-specific parser returned nothing, try the generic fallback
  if (parsed.categories.length === 0 && platform !== 'generic') {
    const fallback = parseGeneric(html);
    if (fallback.categories.length > 0) {
      parsed = fallback;
    }
  }

  const totalItems = parsed.categories.reduce((s, c) => s + c.items.length, 0);
  return {
    source: target,
    platform,
    categories: parsed.categories,
    totalItems,
    hasProductPhotos: parsed.hasPhotos,
  };
}
