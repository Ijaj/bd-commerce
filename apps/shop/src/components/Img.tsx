import type { ImageSet } from '~/lib/types';
import s from './Img.module.css';

/**
 * Responsive <img> from an ImageSet (imgproxy WebP at 320/640/1200 wide).
 * Lazy by default; pass `priority` for the LCP image (eager + fetchpriority high).
 * `sizes` must describe the rendered width, e.g. "(max-width: 640px) 50vw, 200px".
 * With no image it renders an aspect-ratio placeholder so layout does not jump.
 */
export function Img({
  image,
  sizes,
  priority = false,
  alt,
  className,
  placeholderRatio = 1,
}: {
  image: ImageSet | null;
  sizes: string;
  priority?: boolean;
  /** Overrides image.alt; use "" for purely decorative images. */
  alt?: string;
  className?: string;
  placeholderRatio?: number;
}) {
  if (!image) {
    return (
      <div
        className={`${s.ph} ${className ?? ''}`}
        style={{ aspectRatio: placeholderRatio }}
        aria-hidden="true"
      />
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: imgproxy already serves sized WebP; next/image is disabled
    <img
      className={`${s.img} ${className ?? ''}`}
      src={image.url640}
      srcSet={`${image.url320} 320w, ${image.url640} 640w, ${image.url1200} 1200w`}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt ?? ''}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}
