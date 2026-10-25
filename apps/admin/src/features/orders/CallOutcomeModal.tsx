import { Button, Group, Modal, Radio, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { notifyApiError } from '~/features/b2b/errors';
import { notifyOk } from '~/features/categories/queries';
import { type CallOutcome, ordersApi } from './api';
import { useInvalidateOrders } from './queries';

const OUTCOMES: { value: CallOutcome; label: string; hint: string }[] = [
  { value: 'confirmed', label: 'Confirmed', hint: 'The customer confirmed the order.' },
  {
    value: 'unreachable',
    label: 'Unreachable',
    hint: 'No answer; the order stays in the queue history.',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    hint: 'The customer cancelled. The order is cancelled and stock released.',
  },
];

/** Records a call outcome (+ optional note) for one order. */
export function CallOutcomeModal({
  opened,
  onClose,
  orderId,
  orderNo,
  initial = 'confirmed',
}: {
  opened: boolean;
  onClose: () => void;
  orderId: string;
  orderNo: string;
  initial?: CallOutcome;
}) {
  const invalidate = useInvalidateOrders();
  const [outcome, setOutcome] = useState<CallOutcome>(initial);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await ordersApi.call(orderId, outcome, note.trim() || undefined);
      notifyOk(`Call logged for ${orderNo}`);
      setNote('');
      invalidate();
      onClose();
    } catch (e) {
      notifyApiError(e, 'Could not log the call');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Log call for ${orderNo}`} size="sm" centered>
      <Stack>
        <Radio.Group value={outcome} onChange={(v) => setOutcome(v as CallOutcome)} label="Outcome">
          <Stack gap="xs" mt="xs">
            {OUTCOMES.map((o) => (
              <Radio key={o.value} value={o.value} label={o.label} />
            ))}
          </Stack>
        </Radio.Group>
        <Text size="xs" c="dimmed">
          {OUTCOMES.find((o) => o.value === outcome)?.hint}
        </Text>
        <Textarea
          label="Note"
          autosize
          minRows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button
            loading={busy}
            color={outcome === 'cancelled' ? 'red' : undefined}
            onClick={submit}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
