import { createFileRoute, redirect } from '@tanstack/react-router';
import { ApiError } from '~/api';
import { PortalFrame } from '~/features/shell/PortalFrame';
import { meQuery } from '~/lib/auth';

export const Route = createFileRoute('/_app')({
  // Every page under _app needs a signed-in, 2FA-verified staff member; `me` lands in route context.
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQuery);
      return { me };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw redirect({
          to: '/login',
          search: { redirect: location.href === '/' ? undefined : location.href },
        });
      }
      throw e;
    }
  },
  component: PortalFrame,
});
