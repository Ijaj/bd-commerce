import { Paper, SimpleGrid, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '~/components/PageHeader';
import { meQuery } from '~/lib/auth';

export const Route = createFileRoute('/_app/')({ component: Dashboard });

function Dashboard() {
  const { data: me } = useQuery(meQuery);
  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome back, ${me?.name ?? ''}.`} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {['Orders today', 'Revenue today', 'Low stock', 'Pending approvals'].map((t) => (
          <Paper key={t}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              {t}
            </Text>
            <Text fz={22} fw={700}>
              -
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Text size="sm" c="dimmed" mt="md">
        Dashboard widgets arrive with orders and reports.
      </Text>
    </>
  );
}
