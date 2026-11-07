'use client';
import type { ReactNode } from 'react';
import { dict, type Lang } from '~/i18n';
import s from './affiliate.module.css';
import type { Loaded } from './useLoad';

/** Loading / error shell for a lazily fetched section. */
export function LoadBox<T>({
  lang,
  state,
  reload,
  children,
}: {
  lang: Lang;
  state: Loaded<T>;
  reload: () => void;
  children: (data: T) => ReactNode;
}) {
  const t = dict(lang).affiliate.dash;
  if (state.status === 'loading') {
    return (
      <p className={s.stateBox} role="status">
        {t.loading}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className={s.stateBox} role="alert">
        <p>{t.loadError}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
          {t.retry}
        </button>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
