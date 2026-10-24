import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { imgproxyConfig, imgproxyUrl } from '../media/imgproxy';

export interface ImageSet {
  alt: string | null;
  width: number;
  height: number;
  url320: string;
  url640: string;
  url1200: string;
}

export interface MediaLike {
  storageKey: string;
  width: number;
  height: number;
  alt: string | null;
}

/** Turns stored media into the signed imgproxy renditions the shop uses (WebP, fit). */
@Injectable()
export class ImageService {
  private readonly cfg;

  constructor(@Inject(ENV) env: Env) {
    this.cfg = imgproxyConfig(env);
  }

  set(media: MediaLike, alt: string | null = media.alt): ImageSet {
    const url = (width: number) =>
      imgproxyUrl(this.cfg, media.storageKey, { width, resize: 'fit' });
    return {
      alt,
      width: media.width,
      height: media.height,
      url320: url(320),
      url640: url(640),
      url1200: url(1200),
    };
  }

  setOrNull(media: MediaLike | null | undefined, alt?: string | null): ImageSet | null {
    return media ? this.set(media, alt) : null;
  }
}
