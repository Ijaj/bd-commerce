import { Center, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { t } from '~/i18n';

/** Centered card used by the login and 2FA screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Center mih="100vh" p="md">
      <Paper w={400} maw="100%" p="lg" shadow="sm">
        <Stack gap="md">
          <div>
            <Text size="xs" fw={700} tt="uppercase" c="indigo" style={{ letterSpacing: '.08em' }}>
              {t('appName')}
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
