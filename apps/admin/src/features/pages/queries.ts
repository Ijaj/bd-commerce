import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { pagesApi } from './api';

export const pagesListQuery = queryOptions({
  queryKey: ['pages', 'list'],
  queryFn: pagesApi.list,
});

export const pageQuery = (id: string) =>
  queryOptions({ queryKey: ['pages', 'detail', id], queryFn: () => pagesApi.get(id) });

export function useInvalidatePages() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['pages'] });
}
