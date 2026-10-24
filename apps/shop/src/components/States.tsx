import Link from 'next/link';
import type { ReactNode } from 'react';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import s from './States.module.css';

type Props = { title?: string; body?: ReactNode; action?: ReactNode };

function Box({ title, body, action, role }: Props & { role?: 'alert' }) {
  return (
    <section className={s.box} role={role}>
      {title ? <h2 className={s.title}>{title}</h2> : null}
      {body ? <p className={s.body}>{body}</p> : null}
      {action}
    </section>
  );
}

/** Nothing to show (empty list/cart/wishlist). Pass an `action` (e.g. a continue-shopping link). */
export function EmptyState({ lang, title, body, action }: Props & { lang: Lang }) {
  return <Box title={title ?? dict(lang).states.emptyTitle} body={body} action={action} />;
}

/** Recoverable failure. */
export function ErrorState({ lang, title, body, action }: Props & { lang: Lang }) {
  const d = dict(lang).states;
  return (
    <Box role="alert" title={title ?? d.errorTitle} body={body ?? d.errorBody} action={action} />
  );
}

export function NotFoundState({ lang }: { lang: Lang }) {
  const d = dict(lang);
  return (
    <Box
      title={d.states.notFoundTitle}
      body={d.states.notFoundBody}
      action={
        <Link className="btn btn-primary" href={href(lang, '/')}>
          {d.common.backHome}
        </Link>
      }
    />
  );
}

/** Placeholder body for routes other agents still have to build. */
export function ComingSoon({ lang, title }: { lang: Lang; title: string }) {
  const d = dict(lang).states;
  return (
    <div className="wrap page">
      <h1 className="page-title">{title}</h1>
      <Box title={d.comingTitle} body={d.comingBody} />
    </div>
  );
}
