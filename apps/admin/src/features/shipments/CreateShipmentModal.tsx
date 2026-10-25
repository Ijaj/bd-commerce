import { Button, Group, Modal, NumberInput, Stack, Table, Text, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyApiError } from '~/features/b2b/errors';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { shipmentsApi } from './api';
import { useInvalidateShipments } from './queries';

export interface ShipLine {
  id: string;
  title: string;
  sku: string;
  optionsText: string | null;
  free: number;
}

/** Pick how many units of each order line go in this parcel; the rest can ship separately. */
export function CreateShipmentModal({
  opened,
  onClose,
  orderId,
  lines,
  codDueP,
}: {
  opened: boolean;
  onClose: () => void;
  orderId: string;
  lines: ShipLine[];
  codDueP: number;
}) {
  const invalidate = useInvalidateShipments();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  // Default = everything still unshipped, the common single-parcel case.
  const value = (l: ShipLine) => qty[l.id] ?? l.free;
  const chosen = lines.map((l) => ({ orderItemId: l.id, qty: value(l) })).filter((i) => i.qty > 0);

  const create = useMutation({
    mutationFn: () => shipmentsApi.create(orderId, chosen, note.trim()),
    onSuccess: (s) => {
      notifyOk(`Shipment ${s.shipmentNo} created, COD ${formatPrice(s.codAmountP)}`);
      invalidate();
      setQty({});
      setNote('');
      onClose();
    },
    onError: (e) => notifyApiError(e, 'Could not create the shipment'),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create shipment" size="lg">
      <Stack>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Unshipped</Table.Th>
              <Table.Th w={110}>Ship now</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Text size="sm">{l.title}</Text>
                  <Text size="xs" c="dimmed">
                    {l.sku}
                    {l.optionsText ? ` · ${l.optionsText}` : ''}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{l.free}</Table.Td>
                <Table.Td>
                  <NumberInput
                    aria-label={`Quantity for ${l.title}`}
                    min={0}
                    max={l.free}
                    allowDecimal={false}
                    allowNegative={false}
                    disabled={l.free === 0}
                    value={value(l)}
                    onChange={(v) => setQty((q) => ({ ...q, [l.id]: Number(v) || 0 }))}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="sm" c="dimmed">
          Cash still due on the order: {formatPrice(codDueP)}. The cash to collect on this parcel is
          worked out when you create it: all of it when this ships everything left, otherwise the
          value of these items plus the delivery charge not yet assigned.
        </Text>
        <Textarea
          label="Note for the packer (optional)"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          maxLength={500}
          autosize
          minRows={2}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button
            loading={create.isPending}
            disabled={chosen.length === 0}
            onClick={() => create.mutate()}
          >
            Create shipment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
