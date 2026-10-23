import { api } from '~/api';
import { send } from './http';
import type { AttributeInput, CategoryInput, CreateAttributeInput } from './types';

const force = (f?: boolean) => (f ? { force: true } : {});

export const categoriesApi = {
  list: () => send(api.GET('/v1/admin/categories')),
  get: (id: string) => send(api.GET('/v1/admin/categories/{id}', { params: { path: { id } } })),
  deletePreview: (id: string) =>
    send(api.GET('/v1/admin/categories/{id}/delete-preview', { params: { path: { id } } })),
  create: (body: CategoryInput) => send(api.POST('/v1/admin/categories', { body })),
  update: (id: string, body: Partial<CategoryInput>) =>
    send(api.PATCH('/v1/admin/categories/{id}', { params: { path: { id } }, body })),
  reorder: (body: { id: string; sort: number }[]) =>
    send(api.POST('/v1/admin/categories/reorder', { body })),
  remove: (id: string, body: { mode: 'move'; targetId?: string } | { mode: 'cascade' }) =>
    send(api.DELETE('/v1/admin/categories/{id}', { params: { path: { id } }, body })),

  createAttribute: (id: string, body: CreateAttributeInput) =>
    send(api.POST('/v1/admin/categories/{id}/attributes', { params: { path: { id } }, body })),
  reorderAttributes: (id: string, body: { id: string; sort: number }[]) =>
    send(
      api.POST('/v1/admin/categories/{id}/attributes/reorder', { params: { path: { id } }, body }),
    ),
  updateAttribute: (attrId: string, body: AttributeInput, f?: boolean) =>
    send(
      api.PATCH('/v1/admin/attributes/{attrId}', {
        params: { path: { attrId }, query: force(f) },
        body,
      }),
    ),
  removeAttribute: (attrId: string, f?: boolean) =>
    send(
      api.DELETE('/v1/admin/attributes/{attrId}', {
        params: { path: { attrId }, query: force(f) },
      }),
    ),
  setOptions: (
    attrId: string,
    body: { id?: string; valueEn: string; valueBn?: string | null }[],
    f?: boolean,
  ) =>
    send(
      api.PUT('/v1/admin/attributes/{attrId}/options', {
        params: { path: { attrId }, query: force(f) },
        body,
      }),
    ),
};
