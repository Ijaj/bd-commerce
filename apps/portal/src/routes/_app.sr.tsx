import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { SrTabBar } from '~/features/sr/SrTabBar';
import { hasPermissions } from '~/lib/perm';

export const Route = createFileRoute('/_app/sr')({
  beforeLoad: ({ context }) => {
    if (!hasPermissions(context.me.permissions, 'sr.portal')) throw redirect({ to: '/' });
  },
  component: () => (
    <>
      <Outlet />
      <SrTabBar />
    </>
  ),
});
