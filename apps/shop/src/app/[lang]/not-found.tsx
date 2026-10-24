'use client';
import { usePathname } from 'next/navigation';
import { NotFoundState } from '~/components/States';
import { langFromPathname } from '~/i18n/routing';

// not-found.tsx gets no route params, so the language comes from the browser path.
export default function NotFound() {
  const lang = langFromPathname(usePathname());
  return (
    <div className="wrap page">
      <NotFoundState lang={lang} />
    </div>
  );
}
