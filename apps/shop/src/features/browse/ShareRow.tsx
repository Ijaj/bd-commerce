'use client';
import { useEffect, useState } from 'react';
import s from './Product.module.css';

export type ShareLabels = {
  heading: string;
  native: string;
  copy: string;
  copied: string;
  whatsapp: string;
  facebook: string;
};

/** C1: share this product. Native share sheet when the browser has one, otherwise copy-link. */
export function ShareRow({
  url,
  title,
  labels,
}: {
  url: string;
  title: string;
  labels: ShareLabels;
}) {
  // Detected after mount so server and first client render match.
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== 'undefined' && !!navigator.share), []);

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // dismissed by the user
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the WhatsApp / Facebook links still work
    }
  }
  const text = encodeURIComponent(`${title} ${url}`);
  return (
    <div className={s.share} role="group" aria-label={labels.heading}>
      <span className={s.shareLabel}>{labels.heading}</span>
      {canShare ? (
        <button type="button" className={s.shareBtn} onClick={share}>
          {labels.native}
        </button>
      ) : (
        <button type="button" className={s.shareBtn} onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </button>
      )}
      <a
        className={s.shareBtn}
        href={`https://wa.me/?text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {labels.whatsapp}
      </a>
      <a
        className={s.shareBtn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {labels.facebook}
      </a>
      <span className={s.srOnly} aria-live="polite">
        {copied ? labels.copied : ''}
      </span>
    </div>
  );
}
