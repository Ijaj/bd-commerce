import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { type QueryClient, useQuery } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { AppLayout } from '~/features/shell/AppLayout';
import { meQuery } from '~/lib/auth';

function NotFound() {
  const { data: me } = useQuery(meQuery);
  const body = (
    <Center h="60vh">
      <Stack align="center" gap="xs">
        <Title order={2}>Page not found</Title>
        <Text c="dimmed">That page does not exist.</Text>
        <Button component={Link} to="/" variant="light">
          Back to dashboard
        </Button>
      </Stack>
    </Center>
  );
  // Signed in: keep the sidebar and top bar around the message.
  return me ? <AppLayout>{body}</AppLayout> : body;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFound,
});
