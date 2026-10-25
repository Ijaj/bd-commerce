import { Icon } from '@bdc/ui';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/** Mockup `.sr-h`: 19px title on the left, optional action on the right. */
export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="sr-h">
      <h1>{children}</h1>
      {right}
    </div>
  );
}

/** "‹ My sales" link above a detail page (mockup `.sr-back`). */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="sr-back">
      <Icon name="chevron" size={14} className="sr-back-ic" />
      {children}
    </Link>
  );
}
