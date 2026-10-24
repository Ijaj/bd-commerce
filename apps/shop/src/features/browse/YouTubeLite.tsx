'use client';
import { useState } from 'react';
import { PlayIcon } from './icons';
import s from './Product.module.css';

/** Q26 video: a thumbnail until clicked, then the privacy-enhanced iframe (no YouTube JS on load). */
export function YouTubeLite({
  id,
  title,
  playLabel,
}: {
  id: string;
  title: string;
  playLabel: string;
}) {
  const [on, setOn] = useState(false);
  return (
    <div className={s.video}>
      {on ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`${playLabel}: ${title}`}>
          {/* biome-ignore lint/performance/noImgElement: third-party poster, loaded lazily */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            width={480}
            height={360}
          />
          <span className={s.play}>
            <PlayIcon size={28} />
          </span>
        </button>
      )}
    </div>
  );
}
