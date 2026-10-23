import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/** Centered card used by the login and 2FA screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  width = 380,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <Center mih="100vh" p="md">
      <Paper w={width} maw="100%" p="xl" shadow="sm">
        <Stack gap="md">
          <div>
            <Text size="xs" fw={700} tt="uppercase" c="indigo" style={{ letterSpacing: '.08em' }}>
              ShopName Admin
            </Text>
            <Title order={2}>{title}</Title>
            {subtitle && (
              <Text size="sm" c="dimmed">
                {subtitle}
              </Text>
            )}
          </div>
          {children}
        </Stack>
      </Paper>
    </Center>
  );
}
