'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorState } from '~/components/States';
import { dict } from '~/i18n';
import { langFromPathname } from '~/i18n/routing';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = langFromPathname(usePathname());
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap page">
      <ErrorState
        lang={lang}
        action={
          <button className="btn btn-primary" type="button" onClick={reset}>
            {dict(lang).common.retry}
          </button>
        }
      />
    </div>
  );
}
