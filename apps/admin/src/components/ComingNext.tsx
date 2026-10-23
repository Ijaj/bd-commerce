import { Paper, Text } from '@mantine/core';
import { PageHeader } from './PageHeader';

/** Stub for pages that later agents/steps replace. */
export function ComingNext({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Paper>
        <Text c="dimmed">Coming next{note ? `: ${note}` : '.'}</Text>
      </Paper>
    </>
  );
}
