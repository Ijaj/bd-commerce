import { Group, Loader, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatNumber, formatPrice } from '~/lib/format';
import { couponErrorMessage } from './errors';
import { reportQuery } from './queries';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xl">{value}</Text>
    </Paper>
  );
}

interface Day {
  date: string;
  uses: number;
  discountP: number;
}

/** Minimal bars: one per day, height = discount given. Exact numbers are in the table below. */
function DailyBars({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.discountP));
  const w = 100 / Math.max(1, days.length);
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      width="100%"
      height={120}
      role="img"
      aria-label="Discount given per day"
    >
      {days.map((d, i) => {
        const h = (d.discountP / max) * 38;
        return (
          <rect
            key={d.date}
            x={i * w + w * 0.1}
            y={40 - h}
            width={w * 0.8}
            height={h}
            fill="var(--mantine-color-blue-6)"
          >
            <title>{`${d.date}: ${formatPrice(d.discountP)} (${d.uses} uses)`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function ReportTab({ id }: { id: string }) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const q = useQuery(reportQuery(id, { from: from ?? undefined, to: to ?? undefined }));
  const r = q.data;

  return (
    <Stack gap="md">
      <Group>
        <DateInput
          label="From"
          clearable
          valueFormat="DD MMM YYYY"
          value={from}
          onChange={setFrom}
          maxDate={to ?? undefined}
        />
        <DateInput
          label="To"
          clearable
          valueFormat="DD MMM YYYY"
          value={to}
          onChange={setTo}
          minDate={from ?? undefined}
        />
      </Group>
      {q.isLoading && <Loader size="sm" aria-label="Loading" />}
      {q.isError && <Text c="red">{couponErrorMessage(q.error, 'Could not load the report')}</Text>}
      {r && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
            <Tile label="Uses" value={formatNumber(r.uses, 0)} />
            <Tile label="Unique customers" value={formatNumber(r.uniqueCustomers, 0)} />
            <Tile label="Revenue" value={formatPrice(r.revenueP)} />
            <Tile label="Discount given" value={formatPrice(r.discountGivenP)} />
            <Tile label="Average order" value={formatPrice(r.avgOrderP)} />
            <Tile label="Reversed" value={formatNumber(r.reversed, 0)} />
          </SimpleGrid>

          <Title order={4}>Per day</Title>
          {r.daily.length === 0 ? (
            <Text size="sm" c="dimmed">
              No uses in this period.
            </Text>
          ) : (
            <>
              <DailyBars days={r.daily} />
              <Table.ScrollContainer minWidth={400}>
                <Table withRowBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="right">Uses</Table.Th>
                      <Table.Th ta="right">Discount given</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {r.daily.map((d) => (
                      <Table.Tr key={d.date}>
                        <Table.Td>{d.date}</Table.Td>
                        <Table.Td ta="right">{d.uses}</Table.Td>
                        <Table.Td ta="right">{formatPrice(d.discountP)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}

          <Title order={4}>Top customers</Title>
          {r.topCustomers.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nobody has used this coupon yet.
            </Text>
          ) : (
            <Table withRowBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th ta="right">Uses</Table.Th>
                  <Table.Th ta="right">Discount given</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {r.topCustomers.map((c) => (
                  <Table.Tr key={c.customerId}>
                    <Table.Td>{c.name}</Table.Td>
                    <Table.Td ta="right">{c.uses}</Table.Td>
                    <Table.Td ta="right">{formatPrice(c.discountP)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </>
      )}
    </Stack>
  );
}
