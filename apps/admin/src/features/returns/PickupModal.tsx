import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { returnsApi } from './api';
import { notifyReturnError } from './errors';
import { type ReturnDetail, useInvalidateReturns } from './queries';

/** Courier pickup booking happens outside the system; this only records that one was arranged. */
export function PickupModal({
  ret,
  opened,
  onClose,
}: {
  ret: ReturnDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateReturns();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await returnsApi.pickupBooked(ret.id, note.trim() || undefined);
      invalidate();
      notifyOk('Pickup recorded');
      setNote('');
      onClose();
    } catch (e) {
      notifyReturnError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Pickup booked" size="sm" centered>
      <Stack>
        <Text size="sm">Record that a courier pickup was arranged for this return.</Text>
        <Textarea
          label="Courier, tracking or pickup time (optional)"
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
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
