import { Button, Checkbox, Group, Modal, Select, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { returnsApi } from './api';
import { notifyReturnError } from './errors';
import { inspectDefaults, restockAllowed } from './logic';
import { type ReturnDetail, useInvalidateReturns } from './queries';

type Condition = 'resellable' | 'damaged';

const CONDITIONS = [
  { value: 'resellable', label: 'Resellable' },
  { value: 'damaged', label: 'Damaged' },
];

/** Every line must be inspected once; only resellable units can go back on the shelf. */
export function InspectModal({
  ret,
  opened,
  onClose,
}: {
  ret: ReturnDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateReturns();
  const [rows, setRows] = useState(() => inspectDefaults(ret.items));
  const [busy, setBusy] = useState(false);

  function setCondition(id: string, condition: Condition) {
    setRows({
      ...rows,
      [id]: { condition, restock: restockAllowed(condition) ? (rows[id]?.restock ?? true) : false },
    });
  }

  async function submit() {
    setBusy(true);
    try {
      await returnsApi.inspect(ret.id, {
        items: ret.items.map((i) => ({
          returnItemId: i.id,
          condition: rows[i.id]?.condition ?? 'resellable',
          restock: rows[i.id]?.restock ?? false,
        })),
      });
      invalidate();
      notifyOk('Return inspected');
      onClose();
    } catch (e) {
      notifyReturnError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Inspect ${ret.returnNo}`} size="lg" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Restocked units are added back to inventory. Damaged units are written off.
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Qty</Table.Th>
              <Table.Th w={150}>Condition</Table.Th>
              <Table.Th w={110}>Restock</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ret.items.map((i) => {
              const row = rows[i.id] ?? { condition: 'resellable' as Condition, restock: true };
              return (
                <Table.Tr key={i.id}>
                  <Table.Td>
                    <Text size="sm">{i.titleSnapshot}</Text>
                    <Text size="xs" c="dimmed">
                      {i.sku}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{i.qty}</Table.Td>
                  <Table.Td>
                    <Select
                      aria-label={`Condition of ${i.titleSnapshot}`}
                      data={CONDITIONS}
                      allowDeselect={false}
                      value={row.condition}
                      onChange={(v) => v && setCondition(i.id, v as Condition)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Restock ${i.titleSnapshot}`}
                      label="Yes"
                      disabled={!restockAllowed(row.condition)}
                      checked={row.restock}
                      onChange={(e) =>
                        setRows({ ...rows, [i.id]: { ...row, restock: e.currentTarget.checked } })
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Save inspection
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
