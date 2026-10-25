import { Button, Group, Modal, Radio, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyOk } from '~/features/categories/queries';
import { returnsApi } from './api';
import { notifyReturnError } from './errors';
import { type ReturnDetail, useInvalidateReturns } from './queries';

type Fault = 'ours' | 'customer';

export function ApproveModal({
  ret,
  opened,
  onClose,
}: {
  ret: ReturnDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateReturns();
  const [fault, setFault] = useState<Fault>('ours');
  const [shippingP, setShippingP] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await returnsApi.approve(ret.id, {
        fault,
        // The API ignores shipping unless the customer is at fault.
        returnShippingP: fault === 'customer' ? (shippingP ?? 0) : undefined,
        note: note.trim() || undefined,
      });
      invalidate();
      notifyOk('Return approved');
      onClose();
    } catch (e) {
      notifyReturnError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Approve ${ret.returnNo}`} size="md" centered>
      <Stack>
        <Radio.Group
          label="Whose fault is it?"
          value={fault}
          onChange={(v) => setFault(v as Fault)}
        >
          <Stack gap={4} mt={4}>
            <Radio value="ours" label="Ours (wrong, damaged or defective item): full refund" />
            <Radio
              value="customer"
              label="Customer (change of mind): return shipping is deducted"
            />
          </Stack>
        </Radio.Group>
        {fault === 'customer' && (
          <>
            <MoneyInput
              label="Return shipping to deduct"
              value={shippingP}
              onChange={setShippingP}
            />
            <Text size="xs" c="dimmed">
              Taken off the refund when the return is refunded.
            </Text>
          </>
        )}
        <Textarea
          label="Note (optional)"
          autosize
          minRows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Approve
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
