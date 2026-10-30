import { EmptyState } from '@bdc/ui';
import { Center, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ApiError } from '~/api';
import { srMeQuery } from '~/features/sr/queries';
import { SrTabBar } from '~/features/sr/SrTabBar';
import { t } from '~/i18n';
import { hasPermissions } from '~/lib/perm';

/**
 * Staff with the portal permission but no SR profile get 403 on every SR call. Probe once (the home
 * page shares this query) and show a friendly note instead of the shell, tab bar and repeated errors.
 */
function SrLayout() {
  const me = useQuery(srMeQuery);
  const noProfile = me.error instanceof ApiError && me.error.status === 403;
  if (noProfile) {
    return (
      <EmptyState icon="user" title={t('noSrTitle')}>
        {t('noSrBody')}
      </EmptyState>
    );
  }
  if (me.isPending) {
    return (
      <Center py="xl" role="status" aria-label={t('loading')}>
        <Loader size="sm" />
      </Center>
    );
  }
  return (
    <>
      <Outlet />
      <SrTabBar />
    </>
  );
}

export const Route = createFileRoute('/_app/sr')({
  beforeLoad: ({ context }) => {
    if (!hasPermissions(context.me.permissions, 'sr.portal')) throw redirect({ to: '/' });
  },
  component: SrLayout,
});
