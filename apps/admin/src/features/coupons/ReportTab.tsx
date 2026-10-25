import { Banner, StatTile, TableWrap } from '@bdc/ui';
import { Group, Loader, Stack, Table, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatNumber, formatPrice } from '~/lib/format';
import classes from './Coupons.module.css';
import { couponErrorMessage } from './errors';
import { reportQuery } from './queries';

function Tile({ label, value }: { label: string; value: string }) {
  return <StatTile label={label} value={value} />;
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
            fill="var(--bdc-c1)"
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
      {q.isLoading && (
        <div className="a-empty">
          <Loader size="sm" aria-label="Loading" />
        </div>
      )}
      {q.isError && (
        <Banner tone="danger">{couponErrorMessage(q.error, 'Could not load the report')}</Banner>
      )}
      {r && (
        <>
          <div className={classes.kpis}>
            <Tile label="Uses" value={formatNumber(r.uses, 0)} />
            <Tile label="Unique customers" value={formatNumber(r.uniqueCustomers, 0)} />
            <Tile label="Revenue" value={formatPrice(r.revenueP)} />
            <Tile label="Discount given" value={formatPrice(r.discountGivenP)} />
            <Tile label="Average order" value={formatPrice(r.avgOrderP)} />
            <Tile label="Reversed" value={formatNumber(r.reversed, 0)} />
          </div>

          <h3 className={classes.sec}>Per day</h3>
          {r.daily.length === 0 ? (
            <Text size="sm" c="dimmed">
              No uses in this period.
            </Text>
          ) : (
            <>
              <DailyBars days={r.daily} />
              <TableWrap>
                <Table miw={400}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th className="num">Uses</Table.Th>
                      <Table.Th className="num">Discount given</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {r.daily.map((d) => (
                      <Table.Tr key={d.date}>
                        <Table.Td>{d.date}</Table.Td>
                        <Table.Td className="num">{d.uses}</Table.Td>
                        <Table.Td className="num">{formatPrice(d.discountP)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </TableWrap>
            </>
          )}

          <h3 className={classes.sec}>Top customers</h3>
          {r.topCustomers.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nobody has used this coupon yet.
            </Text>
          ) : (
            <TableWrap>
              <Table miw={400}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th className="num">Uses</Table.Th>
                    <Table.Th className="num">Discount given</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {r.topCustomers.map((c) => (
                    <Table.Tr key={c.customerId}>
                      <Table.Td>{c.name}</Table.Td>
                      <Table.Td className="num">{c.uses}</Table.Td>
                      <Table.Td className="num">{formatPrice(c.discountP)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </TableWrap>
          )}
        </>
      )}
    </Stack>
  );
}
