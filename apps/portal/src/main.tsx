import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient, setUnauthorizedHandler } from './api';
import { router } from './router';
import { theme } from './theme';

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
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-center" />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);

// Hand-written service worker: app shell only, never /v1/* (see public/sw.js).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
