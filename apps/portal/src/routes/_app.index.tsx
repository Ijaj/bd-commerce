import { Stack, Text, Title } from '@mantine/core';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { t } from '~/i18n';
import { hasPermissions } from '~/lib/perm';

export const Route = createFileRoute('/_app/')({
  // Sections by permission. Supplier / affiliate sections get their own branch here later.
  beforeLoad: ({ context }) => {
    if (hasPermissions(context.me.permissions, 'sr.portal')) throw redirect({ to: '/sr' });
  },
  component: NoAccess,
});

function NoAccess() {
  return (
    <Stack gap="xs" py="xl" align="center" ta="center">
      <Title order={2}>{t('noAccessTitle')}</Title>
      <Text c="dimmed">{t('noAccessBody')}</Text>
    </Stack>
  );
}
