import { useQuery } from '@tanstack/react-query';
import { meQuery } from '~/lib/auth';

/** Pure check, handy outside React: does this permission list allow every wanted key? */
export function hasPermissions(have: readonly string[] | undefined, ...wanted: string[]) {
  return wanted.every((p) => have?.includes(p));
}

/**
 * True when the signed-in staff holds ALL given permissions.
 *   const canEdit = useCan('products.edit');
 */
export function useCan(...permissions: string[]): boolean {
  const { data } = useQuery(meQuery);
  return hasPermissions(data?.permissions, ...permissions);
}

/** True when the staff holds at least one of the given permissions. */
export function useCanAny(...permissions: string[]): boolean {
  const { data } = useQuery(meQuery);
  return permissions.some((p) => data?.permissions.includes(p as never));
}
