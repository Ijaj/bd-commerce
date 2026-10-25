import { Banner, TableWrap } from '@bdc/ui';
import { List, Table, Text } from '@mantine/core';
import { formatPrice } from '~/lib/format';
import classes from './BulkSales.module.css';
import type { BulkPreview } from './queries';

/** Result of the dry run: counts, why variants were skipped, and a sample of old -> new prices. */
export function PreviewPanel({ preview }: { preview: BulkPreview }) {
  return (
    <div>
      <Text size="sm" mb="xs">
        {preview.count} variant{preview.count === 1 ? '' : 's'} will get a sale price.
      </Text>
      {preview.skipped > 0 && (
        <List size="sm" mb="xs">
          {preview.skippedExisting > 0 && (
            <List.Item>{preview.skippedExisting} skipped: already on sale</List.Item>
          )}
          {preview.skippedPrice > 0 && (
            <List.Item>
              {preview.skippedPrice} skipped: the new price would be under ৳1 or not lower
            </List.Item>
          )}
        </List>
      )}
      {preview.tooMany && (
        <Banner tone="danger">
          This matches too many variants (the limit is {preview.limit}). Narrow the scope before
          applying.
        </Banner>
      )}
      {preview.sample.length > 0 && (
        <>
          <TableWrap>
            <Table miw={520}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Variant</Table.Th>
                  <Table.Th className="num">Regular</Table.Th>
                  <Table.Th className="num">Now</Table.Th>
                  <Table.Th className="num">New sale price</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.sample.map((s) => (
                  <Table.Tr key={s.variantId}>
                    <Table.Td>
                      {s.title}
                      <span className={classes.sub}>{s.sku}</span>
                    </Table.Td>
                    <Table.Td className="num">{formatPrice(s.priceP)}</Table.Td>
                    <Table.Td className="num">
                      {s.currentSalePriceP === null ? '-' : formatPrice(s.currentSalePriceP)}
                    </Table.Td>
                    <Table.Td className="num">{formatPrice(s.newSalePriceP)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableWrap>
          <Text size="xs" c="dimmed" mt={4}>
            Showing {preview.sample.length} of {preview.count}.
          </Text>
        </>
      )}
    </div>
  );
}
