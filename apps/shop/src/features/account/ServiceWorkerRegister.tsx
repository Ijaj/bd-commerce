'use client';
import { useEffect } from 'react';

/** Registers /sw.js in production builds only (a dev SW would cache stale chunks). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // PWA features are optional; the shop works the same without them.
      });
    };
    // After load so the worker's install never competes with first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
