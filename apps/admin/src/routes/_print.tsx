import { createFileRoute, redirect } from '@tanstack/react-router';
import { ApiError } from '~/api';
import { PrintLayout } from '~/features/documents/PrintShell';
import { meQuery } from '~/lib/auth';

// Same sign-in guard as _app, but no sidebar or header: print views are bare pages.
export const Route = createFileRoute('/_print')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQuery);
      return { me };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw redirect({ to: '/login', search: { redirect: location.href } });
      }
      throw e;
    }
  },
  component: PrintLayout,
});
