import { Button } from '@mantine/core';
import { t } from '~/i18n';

/** "Load more" for useInfiniteQuery lists. */
export function LoadMore({
  query,
}: {
  query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
}) {
  if (!query.hasNextPage) return null;
  return (
    <Button
      variant="default"
      fullWidth
      loading={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {t('loadMore')}
    </Button>
  );
}
