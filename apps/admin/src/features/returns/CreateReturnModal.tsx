import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { returnsApi } from './api';
import { notifyReturnError } from './errors';
import { REASON_OPTIONS, returnableQty } from './logic';
import { type OrderDetail, type ReturnReason, useInvalidateReturns } from './queries';

interface Pick {
  qty: number;
  reason: ReturnReason;
}

/** Staff-side return on behalf of a customer (phone request, counter return). */
export function CreateReturnModal({
  order,
  opened,
  onClose,
}: {
  order: OrderDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateReturns();
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [note, setNote] = useState('');
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  const chosen = order.items.filter((l) => (picks[l.id]?.qty ?? 0) > 0);

  function patch(id: string, p: Partial<Pick>) {
    setPicks({ ...picks, [id]: { qty: 0, reason: 'other', ...picks[id], ...p } });
  }

  async function submit() {
    setBusy(true);
    try {
      await returnsApi.create(order.id, {
        items: chosen.map((l) => ({
          orderItemId: l.id,
          qty: picks[l.id]?.qty ?? 0,
          reason: picks[l.id]?.reason ?? 'other',
        })),
        note: note.trim() || undefined,
        windowOverride: override || undefined,
      });
      invalidate();
      notifyOk('Return created');
      onClose();
    } catch (e) {
      notifyReturnError(e, 'Could not create the return');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`New return for ${order.orderNo}`}
      size="xl"
      centered
    >
      <Stack>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Can return</Table.Th>
              <Table.Th w={100}>Qty</Table.Th>
              <Table.Th w={190}>Reason</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {order.items.map((l) => {
              const max = returnableQty(l);
              const pick = picks[l.id];
              return (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Text size="sm">{l.titleSnapshot}</Text>
                    <Text size="xs" c="dimmed">
                      {l.sku}
                      {l.optionsText ? ` · ${l.optionsText}` : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{max}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`Return qty for ${l.titleSnapshot}`}
                      min={0}
                      max={max}
                      allowDecimal={false}
                      disabled={max === 0}
                      value={pick?.qty ?? 0}
                      onChange={(v) => patch(l.id, { qty: Number(v) || 0 })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      aria-label={`Reason for ${l.titleSnapshot}`}
                      data={REASON_OPTIONS}
                      allowDeselect={false}
                      value={pick?.reason ?? 'other'}
                      onChange={(v) => v && patch(l.id, { reason: v as ReturnReason })}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        <Text size="xs" c="dimmed">
          The limit shown ignores returns that are still open; the system checks it again on save.
        </Text>
        <Textarea
          label="Note (optional)"
          autosize
          minRows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Checkbox
          label="Allow even if the return window has closed"
          checked={override}
          onChange={(e) => setOverride(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} disabled={chosen.length === 0} onClick={submit}>
            Create return
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
