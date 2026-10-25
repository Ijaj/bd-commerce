import { Alert, List, Table, Text } from '@mantine/core';
import { formatPrice } from '~/lib/format';
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
        <Alert color="red" mb="xs" role="alert">
          This matches too many variants (the limit is {preview.limit}). Narrow the scope before
          applying.
        </Alert>
      )}
      {preview.sample.length > 0 && (
        <>
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Variant</Table.Th>
                  <Table.Th ta="right">Regular</Table.Th>
                  <Table.Th ta="right">Now</Table.Th>
                  <Table.Th ta="right">New sale price</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.sample.map((s) => (
                  <Table.Tr key={s.variantId}>
                    <Table.Td>
                      <Text size="sm">{s.title}</Text>
                      <Text size="xs" c="dimmed">
                        {s.sku}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">{formatPrice(s.priceP)}</Table.Td>
                    <Table.Td ta="right">
                      {s.currentSalePriceP === null ? '-' : formatPrice(s.currentSalePriceP)}
                    </Table.Td>
                    <Table.Td ta="right">{formatPrice(s.newSalePriceP)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Text size="xs" c="dimmed" mt={4}>
            Showing {preview.sample.length} of {preview.count}.
          </Text>
        </>
      )}
    </div>
  );
}
