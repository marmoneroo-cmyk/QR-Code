'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * Guest-facing image primitive.
 *
 * Built-in menu art lives in /public (`/cocktail/*.png`, `/Food/*.png`) and benefits
 * from Next's optimizer: AVIF/WebP negotiation + a responsive srcset, which is a real
 * first-load win on the guest menu. But operator uploads are stored as `data:`/`blob:`
 * URLs (see MediaLibrary / CocktailForm `readAsDataURL`), and the optimizer cannot touch
 * those — it would throw. So we branch: `next/image` for real paths, a plain `<img>` for
 * inline uploads. Same visual result either way; the caller's classes/styles carry over.
 *
 * Always renders in `fill` mode, so the parent must be positioned (relative/absolute) and
 * have a resolved size. Pass `sizes` so the optimizer can pick the right srcset entry.
 */
interface SmartImageProps {
  src: string;
  alt: string;
  /** Classes for the rendered image (object-fit, padding, transitions, drop-shadow, …). */
  className?: string;
  style?: CSSProperties;
  /** Responsive hint, e.g. "(max-width: 768px) 45vw, 20vw". Defaults to full-width. */
  sizes?: string;
  /** Eager-load + high priority for above-the-fold hero images. */
  priority?: boolean;
}

function isInlineUpload(src: string): boolean {
  return src.startsWith('data:') || src.startsWith('blob:');
}

export function SmartImage({ src, alt, className, style, sizes, priority }: SmartImageProps) {
  if (isInlineUpload(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full ${className ?? ''}`}
        style={style}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? '100vw'}
      className={className}
      style={style}
      priority={priority}
    />
  );
}
