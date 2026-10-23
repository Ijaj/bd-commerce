import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, unwrap } from '~/api';
import { formatNumber } from '~/lib/format';
import { type AdjustMode, adjustResult, checkAdjust, optionText } from './logic';
import { type InventoryRow, inventoryKey } from './queries';

export function AdjustModal({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<AdjustMode>('delta');
  const [qty, setQty] = useState<number | string>('');
  const [note, setNote] = useState('');

  const variantId = row?.variantId;
  useEffect(() => {
    if (variantId) {
      setMode('delta');
      setQty('');
      setNote('');
    }
  }, [variantId]);

  const save = useMutation({
    mutationFn: (v: { variantId: string; mode: AdjustMode; qty: number; note: string }) =>
      unwrap(
        api.POST('/v1/admin/inventory/{variantId}/adjust', {
          params: { path: { variantId: v.variantId } },
          body: { mode: v.mode, qty: v.qty, note: v.note },
        }),
      ),
    onSuccess: (res) => {
      notifications.show({
        color: 'green',
        message: `Stock updated: ${formatNumber(res.onHand)} on hand`,
      });
      qc.invalidateQueries({ queryKey: inventoryKey });
      onClose();
    },
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  if (!row) return <Modal opened={false} onClose={onClose} title="Adjust stock" />;

  const n = typeof qty === 'number' ? qty : null;
  const check = checkAdjust(mode, row.onHand, n);
  const result = adjustResult(mode, row.onHand, n);
  const noteOk = note.trim().length > 0;
  const belowReserved = result !== null && result >= 0 && result < row.reserved;
  const options = optionText(row.optionLabels);

  return (
    <Modal opened onClose={onClose} title="Adjust stock" centered>
      <Stack gap="sm">
        <div>
          <Text fw={500}>{row.productTitleEn}</Text>
          <Text size="xs" c="dimmed">
            {options ? `${options} · ` : ''}SKU {row.sku}
          </Text>
        </div>
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(v) => setMode(v as AdjustMode)}
          data={[
            { value: 'delta', label: 'Add / remove' },
            { value: 'set', label: 'Set exact count' },
          ]}
        />
        <NumberInput
          label={mode === 'delta' ? 'Change (use a minus to remove)' : 'New on-hand count'}
          value={qty}
          onChange={setQty}
          allowDecimal={false}
          allowNegative={mode === 'delta'}
          min={mode === 'set' ? 0 : -1_000_000}
          max={1_000_000}
          data-autofocus
        />
        <Textarea
          label="Note"
          description="Required. Saved in the stock history."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          maxLength={500}
          autosize
          minRows={2}
        />
        <Alert variant="light" color={check.ok || n === null ? 'indigo' : 'red'} p="xs">
          <Text size="sm">
            On hand: {formatNumber(row.onHand)} &rarr;{' '}
            <Text span fw={700}>
              {result === null ? '-' : formatNumber(result)}
            </Text>
            {!check.ok && n !== null ? ` (${check.reason})` : ''}
          </Text>
          {belowReserved && (
            <Text size="xs" c="orange">
              Below the {formatNumber(row.reserved)} currently reserved.
            </Text>
          )}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={!check.ok || !noteOk || n === null}
            onClick={() =>
              n !== null &&
              save.mutate({ variantId: row.variantId, mode, qty: n, note: note.trim() })
            }
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
