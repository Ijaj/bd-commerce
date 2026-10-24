import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { routeTree } from '~/routeTree.gen';
import { theme } from '~/theme';

type Handler = (url: URL, init?: RequestInit) => unknown;

/** Replaces global fetch: routes by "METHOD /path"; unknown routes fail the test loudly. */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input), 'http://localhost');
    const method = (req?.method ?? init?.method ?? 'GET').toUpperCase();
    const raw = req ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ method, path: url.pathname, body: raw ? JSON.parse(raw) : undefined });
    const hit = routes[`${method} ${url.pathname}`];
    if (hit === undefined) {
      return new Response(JSON.stringify({ message: `unmocked ${method} ${url.pathname}` }), {
        status: 404,
      });
    }
    const out = typeof hit === 'function' ? (hit as Handler)(url, init) : hit;
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}

export const unauthorized = () =>
  new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    <MantineProvider theme={theme} env="test">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

export const staff = (permissions: string[]) => ({
  id: 's1',
  name: 'Rahim Uddin',
  email: 'rahim@example.com',
  roles: [],
  permissions,
});
