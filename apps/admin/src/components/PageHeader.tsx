import { PageHeader as UiPageHeader } from '@bdc/ui';
import type { ReactNode } from 'react';

/** Page title row (`.a-ph`): crumbs, left-bar title, optional description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode[];
}) {
  return <UiPageHeader title={title} description={description} actions={actions} crumbs={crumbs} />;
}
