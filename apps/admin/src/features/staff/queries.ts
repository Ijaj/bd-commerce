import { api, unwrap } from '~/api';

export const staffQuery = {
  queryKey: ['staff'],
  queryFn: () => unwrap(api.GET('/v1/admin/staff')),
};

export const rolesQuery = {
  queryKey: ['roles'],
  queryFn: () => unwrap(api.GET('/v1/admin/roles')),
};

export const permissionsQuery = {
  queryKey: ['permissions'],
  queryFn: () => unwrap(api.GET('/v1/admin/permissions')),
  staleTime: 5 * 60_000,
};

export type StaffRow = Awaited<ReturnType<typeof staffQuery.queryFn>>[number];
export type RoleRow = Awaited<ReturnType<typeof rolesQuery.queryFn>>[number];
export type PermissionKey = RoleRow['permissions'][number];
