import { notifications } from '@mantine/notifications';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from './api';

export const categoriesListQuery = queryOptions({
  queryKey: ['categories', 'list'],
  queryFn: categoriesApi.list,
});

export const categoryDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ['categories', 'detail', id],
    queryFn: () => categoriesApi.get(id),
  });

/** Everything category-shaped (list, details); also product pickers that cache category data. */
export function useInvalidateCategories() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['categories'] });
}

export function notifyError(e: unknown, fallback = 'Something went wrong') {
  notifications.show({ color: 'red', message: e instanceof Error ? e.message : fallback });
}

export function notifyOk(message: string) {
  notifications.show({ color: 'teal', message });
}

/** A saved image/ref as the MediaDto shape ImageUpload expects. */
export function refToMedia(ref: { mediaId: string; url: string } | null) {
  return ref
    ? {
        id: ref.mediaId,
        mime: '',
        width: 0,
        height: 0,
        bytes: 0,
        alt: null,
        url: ref.url,
        thumbUrl: ref.url,
        createdAt: '',
      }
    : null;
}
