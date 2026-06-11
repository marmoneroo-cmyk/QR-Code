const STYLE_SUFFIX =
  'cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, photorealistic, 8k';

export function buildHeroPrompt(input: {
  name: string;
  tagline?: string;
  description?: string;
}): string {
  const base = input.description?.trim() || input.tagline?.trim() || input.name.trim();
  return `A beautifully lit cocktail named "${input.name.trim()}": ${base}, served in a fitting glass, with elegant garnish, floating against pure pitch black background with no surface or shadow below, ${STYLE_SUFFIX}`;
}

export function buildPollinationsUrl(
  prompt: string,
  options: { width?: number; height?: number; seed?: number } = {}
): string {
  const width = options.width ?? 1024;
  const height = options.height ?? 1280;
  const seed = options.seed ?? Math.floor(Math.random() * 100000);
  const encoded = encodeURIComponent(prompt);
  // pollinations.ai now gates anonymous generation behind a Cloudflare Turnstile
  // check ({"error":"Missing Turnstile token"} → 403). Register a (free) app token at
  // https://auth.pollinations.ai and set NEXT_PUBLIC_POLLINATIONS_TOKEN to bypass it;
  // without a token, generation is unavailable and the UI falls back to manual upload.
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    model: 'flux',
    referrer: 'cocktail-demo',
  });
  const token = process.env.NEXT_PUBLIC_POLLINATIONS_TOKEN;
  if (token) params.set('token', token);
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

/**
 * A ready-to-paste ChatGPT / DALL·E prompt for a menu item's photo, in the app's
 * house style: subject centered and fully visible, pure black background, portrait,
 * no text. Works for both drinks and plated food. The owner pastes this into
 * ChatGPT, downloads the PNG, and uploads it in the editor.
 */
export function buildGptImagePrompt(input: { name: string; description?: string | null }): string {
  const name = input.name.trim();
  const desc = input.description?.trim();
  const made = desc ? `, ${desc}` : '';
  return (
    `A beautifully lit, photorealistic studio shot of "${name}"${made}. ` +
    `Centered and fully visible with generous margin so nothing is cropped, elegant garnish/plating, ` +
    `against a pure solid black background with no surface and no shadow. ` +
    `Cinematic product photography, dramatic moody lighting from the upper-right, ultra-sharp focus, 8k, ` +
    `portrait 4:5 orientation. No text, no watermark, no logo.`
  );
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'untitled';
}
