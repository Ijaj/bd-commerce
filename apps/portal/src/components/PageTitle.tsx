import { Anchor, Group, Title } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap" mb="sm">
      <Title order={1}>{children}</Title>
      {right}
    </Group>
  );
}

/** "‹ My sales" link above a detail page. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Anchor
      component={Link}
      to={to}
      size="sm"
      display="inline-flex"
      mb="xs"
      style={{ alignItems: 'center' }}
    >
      <IconChevronLeft size={16} />
      {children}
    </Anchor>
  );
}
