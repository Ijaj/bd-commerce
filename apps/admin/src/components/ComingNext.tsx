import { EmptyState, SectionCard } from '@bdc/ui';
import { PageHeader } from './PageHeader';

/** Stub for pages that later agents/steps replace. */
export function ComingNext({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <SectionCard>
        <EmptyState icon="info" title="Coming next">
          {note}
        </EmptyState>
      </SectionCard>
    </>
  );
}
