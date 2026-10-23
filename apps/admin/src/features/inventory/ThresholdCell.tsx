import { ActionIcon, Group, NumberInput, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { type InventoryRow, inventoryKey } from './queries';

/** Low-stock threshold with inline edit (empty = no alert). */
export function ThresholdCell({ row, canEdit }: { row: InventoryRow; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | string>('');

  const save = useMutation({
    mutationFn: (lowStockThreshold: number | null) =>
      unwrap(
        api.PATCH('/v1/admin/inventory/{variantId}', {
          params: { path: { variantId: row.variantId } },
          body: { lowStockThreshold },
        }),
      ),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Threshold saved' });
      qc.invalidateQueries({ queryKey: inventoryKey });
      setEditing(false);
    },
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  if (editing) {
    return (
      <Group gap={4} wrap="nowrap" justify="flex-end">
        <NumberInput
          size="xs"
          w={80}
          min={0}
          max={1_000_000}
          allowDecimal={false}
          allowNegative={false}
          placeholder="None"
          value={value}
          onChange={setValue}
          aria-label="Low-stock threshold"
          data-autofocus
        />
        <ActionIcon
          size="sm"
          color="green"
          variant="light"
          aria-label="Save threshold"
          loading={save.isPending}
          onClick={() => save.mutate(typeof value === 'number' ? value : null)}
        >
          <IconCheck size={14} />
        </ActionIcon>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          aria-label="Cancel"
          onClick={() => setEditing(false)}
        >
          <IconX size={14} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Text size="sm" c={row.lowStockThreshold === null ? 'dimmed' : undefined}>
        {row.lowStockThreshold ?? '-'}
      </Text>
      {canEdit && (
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          aria-label="Edit threshold"
          onClick={() => {
            setValue(row.lowStockThreshold ?? '');
            setEditing(true);
          }}
        >
          <IconPencil size={14} />
        </ActionIcon>
      )}
    </Group>
  );
}
