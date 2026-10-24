import {
  ActionIcon,
  Group,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconLogout, IconMoon, IconSun } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { api } from '~/api';
import { LangToggle } from '~/components/LangToggle';
import { t } from '~/i18n';

/** Fixed top bar + padded main area shared by every portal section. */
export function PortalFrame() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  async function logout() {
    await api.POST('/v1/admin/auth/logout').catch(() => undefined);
    qc.clear();
    void navigate({ to: '/login', search: {} });
  }

  return (
    <>
      <header className="portal-top">
        <Group h={48} px="md" justify="space-between" wrap="nowrap">
          <Text fw={800} tt="uppercase" fs="italic" fz="lg" style={{ letterSpacing: '-.02em' }}>
            ShopName <span style={{ color: '#5eead4' }}>Partner</span>
          </Text>
          <Group gap={4} wrap="nowrap">
            <LangToggle dark />
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={t('darkMode')}
              onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
            >
              {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={t('signOut')}
              onClick={() => void logout()}
            >
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </header>
      <main className="portal-main">
        <Outlet />
      </main>
    </>
  );
}
