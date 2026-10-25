import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/tiptap/styles.css';
import '@bdc/ui/styles.css';
import './styles.css';

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient, setUnauthorizedHandler } from './api';
import { router } from './router';
import { bdcColorSchemeManager, bdcCssVariablesResolver, theme } from './theme';

// Any 401 outside the auth endpoints means the session is gone: go to /login, keep the return path.
setUnauthorizedHandler(() => {
  const here = router.state.location;
  if (here.pathname === '/login' || here.pathname.startsWith('/2fa/')) return;
  queryClient.clear();
  void router.navigate({
    to: '/login',
    search: { redirect: here.href === '/' ? undefined : here.href },
  });
});

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
      colorSchemeManager={bdcColorSchemeManager}
      cssVariablesResolver={bdcCssVariablesResolver}
    >
      <ModalsProvider>
        <Notifications position="top-right" />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
