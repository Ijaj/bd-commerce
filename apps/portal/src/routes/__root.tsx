import { Button, Center, Stack, Text, Title } from '@mantine/core';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { useLang } from '~/i18n';

/** Remounts the tree on a language switch so every t() call re-reads (query cache is kept). */
function RootLayout() {
  const lang = useLang();
  return <Outlet key={lang} />;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: () => (
    <Center h="60vh">
      <Stack align="center" gap="xs">
        <Title order={2}>Page not found</Title>
        <Text c="dimmed">That page does not exist.</Text>
        <Button component={Link} to="/" variant="light">
          Back home
        </Button>
      </Stack>
    </Center>
  ),
});
