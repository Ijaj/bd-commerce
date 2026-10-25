import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { t } from '~/i18n';

/** Loading / error / data switch so each screen only writes the happy path. */
interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => Promise<unknown>;
}

export function QueryBoundary<T>({
  query,
  children,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <div className="sr-card">
        <Center py="md" role="status" aria-label={t('loading')}>
          <Loader size="sm" />
        </Center>
      </div>
    );
  }
  if (query.isError) {
    return (
      <Stack gap="xs" py="md">
        <Alert color="red" variant="light">
          {query.error instanceof Error ? query.error.message : t('loadFailed')}
        </Alert>
        <Button variant="default" onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </Stack>
    );
  }
  return <>{children(query.data as T)}</>;
}
