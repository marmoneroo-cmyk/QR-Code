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
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
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
