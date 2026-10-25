import {
  AppShell,
  Badge,
  Burger,
  Button,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '~/api';
import { useCallQueueCount } from '~/features/orders/queries';
import { meQuery } from '~/lib/auth';
import { isActive, visibleNav } from '~/lib/nav';
import { ChangePasswordModal } from './ChangePasswordModal';

export function AppLayout() {
  const { data: me } = useQuery(meQuery);
  const [mobileOpen, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopOpen, { toggle: toggleDesktop }] = useDisclosure(true);
  const [pwOpen, setPwOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = visibleNav(me?.permissions ?? []);
  const callQueueCount = useCallQueueCount();

  async function logout() {
    await api.POST('/v1/admin/auth/logout').catch(() => undefined);
    qc.clear();
    void navigate({ to: '/login', search: {} });
  }

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{
        width: 220,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpen, desktop: !desktopOpen },
      }}
      padding="md"
    >
      <AppShell.Header
        style={{ background: 'linear-gradient(90deg, #312e81, #4338ca)', color: '#fff', border: 0 }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              color="white"
              size="sm"
              opened={mobileOpen}
              onClick={toggleMobile}
              hiddenFrom="sm"
              aria-label="Toggle navigation"
            />
            <Burger
              color="white"
              size="sm"
              opened={desktopOpen}
              onClick={toggleDesktop}
              visibleFrom="sm"
              aria-label="Collapse navigation"
            />
            <Text fw={800} tt="uppercase" fs="italic" fz="lg" style={{ letterSpacing: '-.02em' }}>
              ShopName <span style={{ color: '#5eead4' }}>Admin</span>
            </Text>
          </Group>
          <Menu position="bottom-end" width={200} withinPortal>
            <Menu.Target>
              <Button variant="subtle" color="white" size="xs" aria-label="Account menu">
                {me?.name ?? 'Account'}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{me?.email}</Menu.Label>
              <Menu.Item onClick={() => setPwOpen(true)}>Change password</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" onClick={logout}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {nav.map((section) => (
            <div key={section.heading ?? 'top'}>
              {section.heading && (
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" px="xs" pt="sm" pb={2}>
                  {section.heading}
                </Text>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  href={item.to}
                  label={item.label}
                  active={isActive(item.to, pathname)}
                  rightSection={
                    item.to === '/call-queue' && callQueueCount ? (
                      <Badge size="sm" color="red" circle>
                        {callQueueCount}
                      </Badge>
                    ) : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    closeMobile();
                    void navigate({ to: item.to });
                  }}
                  style={{ borderRadius: 4 }}
                />
              ))}
            </div>
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <ChangePasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} />
    </AppShell>
  );
}
