'use client';
import { useEffect, useRef } from 'react';
import { browserApi } from '~/lib/api-browser';
import { landingFrom, utmFrom } from './logic';

/**
 * Affiliate link capture: `?ref=CODE` on any page load records one click, then the param is removed
 * from the address bar so shared/bookmarked URLs stay clean. Never blocks render; errors are ignored.
 * Reads window.location (not useSearchParams) so statically cached pages stay static.
 */
export function RefCapture() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const { pathname, search, hash } = window.location;
    const code = new URLSearchParams(search).get('ref')?.trim();
    if (!code) return;
    const landingUrl = landingFrom(pathname, search);
    const utm = utmFrom(search);
    void Promise.resolve(
      browserApi.POST('/v1/public/affiliates/click', {
        body: {
          code: code.slice(0, 32),
          landingUrl: landingUrl.slice(0, 500),
          ...(Object.keys(utm).length ? { utm } : {}),
        },
      }),
    ).catch(() => undefined);
    try {
      window.history.replaceState(window.history.state, '', landingUrl + hash);
    } catch {
      // ignore: the click is already recorded
    }
  }, []);
  return null;
}
