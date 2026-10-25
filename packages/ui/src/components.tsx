import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon.js';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

/** Tone → Mantine colour name, for components that take `color` (Badge, Button, Alert...). */
export const TONE_COLOR: Record<Tone, string> = {
  ok: 'green',
  warn: 'yellow',
  danger: 'red',
  info: 'blue',
  muted: 'gray',
};

/** `.a-ph`: crumbs, title with the 5px left bar, optional muted description, actions on the right. */
export function PageHeader({
  title,
  crumbs,
  description,
  actions,
}: {
  title: ReactNode;
  /** Strings or links (e.g. router `<Link>`); separated by "/". */
  crumbs?: ReactNode[];
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="a-ph">
      <div className="a-ph-l">
        {crumbs && crumbs.length > 0 && (
          <div className="a-crumbs">
            {crumbs.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: crumbs are positional
              <span key={i}>
                {i > 0 && <i>/</i>}
                {c}
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {description && <p className="a-ph-desc">{description}</p>}
      </div>
      {actions && <div className="a-ph-r">{actions}</div>}
    </div>
  );
}

/** `.a-stat`: uppercase label, big value, delta line (`up` green ▲ / `down` red ▼ / neutral). */
export function StatTile({
  label,
  value,
  delta,
  deltaDir,
  icon,
  alert,
  className,
  ...rest
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaDir?: 'up' | 'down' | 'neutral';
  icon?: IconName;
  /** Warn-tinted border (dashboard "needs attention" tiles). */
  alert?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('a-stat', alert && 'alert', className)} {...rest}>
      {icon && (
        <div className="ic">
          <Icon name={icon} size={22} />
        </div>
      )}
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {delta !== undefined && (
        <div className={cx('d', deltaDir && deltaDir !== 'neutral' && deltaDir)}>{delta}</div>
      )}
    </div>
  );
}

/** `.a-badge.<tone>`. Map domain statuses to a tone in the feature; this only paints. */
export function StatusBadge({
  tone = 'muted',
  children,
  className,
  ...rest
}: { tone?: Tone; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('a-badge', tone, className)} {...rest}>
      {children}
    </span>
  );
}

/** `.a-toolbar`: wrapping filter row (search, selects, chips). Give the search `className="grow"`. */
export function Toolbar({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('a-toolbar', className)} {...rest} />;
}

/** `.a-empty`: icon, title, text, optional action. */
export function EmptyState({
  icon = 'search',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="a-empty">
      <Icon name={icon} size={34} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="a-empty-act">{action}</div>}
    </div>
  );
}

/** `.a-kv`: key/value grid. */
export function KeyValue({
  items,
  className,
}: {
  items: Array<[ReactNode, ReactNode]>;
  className?: string;
}) {
  return (
    <dl className={cx('a-kv', className)}>
      {items.map(([k, v], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
        <div key={i} className="a-kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `.a-split`: list (280–360px) + detail; stacks under 900px. */
export function SplitPane({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('a-split', className)} {...rest} />;
}

/** `.a-table-wrap`: bordered box that scrolls tables sideways on small screens. */
export function TableWrap({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('a-table-wrap', className)} {...rest} />;
}

/** `.a-card` with optional `.a-card-h` header (title + actions) and `.a-card-b` body (`flush` = no padding). */
export function SectionCard({
  title,
  actions,
  flush,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx('a-card', className)}>
      {(title || actions) && (
        <div className="a-card-h">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cx('a-card-b', flush && 'flush', bodyClassName)}>{children}</div>
    </section>
  );
}

/** `.a-banner`: inline notice (warn by default). */
export function Banner({
  tone = 'warn',
  icon = 'warn',
  children,
  actions,
}: {
  tone?: 'warn' | 'info' | 'danger';
  icon?: IconName;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cx('a-banner', tone !== 'warn' && tone)} role="status">
      <Icon name={icon} />
      <div>{children}</div>
      {actions && (
        <>
          <span className="a-sp" />
          {actions}
        </>
      )}
    </div>
  );
}
