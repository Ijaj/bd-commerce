import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { carouselApi } from './api';

export const carouselQuery = queryOptions({
  queryKey: ['carousel', 'list'],
  queryFn: carouselApi.list,
});

/** Slides are shown on the storefront home page too, so this is the only cache to refresh. */
export function useInvalidateCarousel() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['carousel'] });
}
