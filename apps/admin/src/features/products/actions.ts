import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '~/api';
import { call, ProductApiError } from './http';
import { productsKey } from './queries';
import type { ProductDetail } from './types';

type Action = 'publish' | 'unpublish' | 'archive' | 'duplicate';

const PATHS = {
  publish: '/v1/admin/products/{id}/publish',
  unpublish: '/v1/admin/products/{id}/unpublish',
  archive: '/v1/admin/products/{id}/archive',
  duplicate: '/v1/admin/products/{id}/duplicate',
} as const;

const DONE: Record<Action, string> = {
  publish: 'Product published',
  unpublish: 'Product moved back to draft',
  archive: 'Product archived',
  duplicate: 'Product duplicated as a draft',
};

/**
 * Status actions shared by the list and the editor. Publish failures (400 with `problems[]`)
 * are surfaced through `problems`; render <ProblemsModal problems={problems} .../> for them.
 */
export function useProductActions(onDone?: (action: Action, p: ProductDetail) => void) {
  const qc = useQueryClient();
  const [problems, setProblems] = useState<string[] | null>(null);

  const run = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) =>
      call(api.POST(PATHS[action], { params: { path: { id } } })),
    onSuccess: (p, { action }) => {
      qc.invalidateQueries({ queryKey: productsKey });
      notifications.show({ color: 'green', message: DONE[action] });
      onDone?.(action, p);
    },
    onError: (e, { action }) => {
      if (action === 'publish' && e instanceof ProductApiError && e.problems.length) {
        setProblems(e.problems);
        return;
      }
      notifications.show({ color: 'red', message: e.message });
    },
  });

  return {
    problems,
    clearProblems: () => setProblems(null),
    pending: run.isPending,
    publish: (id: string) => run.mutate({ id, action: 'publish' }),
    unpublish: (id: string) => run.mutate({ id, action: 'unpublish' }),
    archive: (id: string) => run.mutate({ id, action: 'archive' }),
    duplicate: (id: string) => run.mutate({ id, action: 'duplicate' }),
  };
}

/** DELETE /products/:id. Resolves 'blocked' (instead of throwing) on 409 so the UI can suggest archive. */
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<'deleted' | 'blocked'> => {
      try {
        await call(api.DELETE('/v1/admin/products/{id}', { params: { path: { id } } }));
        return 'deleted';
      } catch (e) {
        if (e instanceof ProductApiError && e.status === 409) return 'blocked';
        throw e;
      }
    },
    onSuccess: (r) => {
      if (r === 'deleted') {
        qc.invalidateQueries({ queryKey: productsKey });
        notifications.show({ color: 'green', message: 'Product deleted' });
      }
    },
  });
}
