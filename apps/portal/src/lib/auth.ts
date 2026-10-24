import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '~/api';

/** The signed-in staff member (id, name, email, roles, permissions). Throws ApiError 401 if signed out. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => unwrap(api.GET('/v1/admin/auth/me')),
  staleTime: 60_000,
  retry: false,
});

export type Me = NonNullable<Awaited<ReturnType<NonNullable<typeof meQuery.queryFn>>>>;
