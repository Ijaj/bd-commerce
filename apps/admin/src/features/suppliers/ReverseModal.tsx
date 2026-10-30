import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { suppliersApi } from './api';
import { notifyApiError } from './errors';
import { LEDGER_TYPE } from './logic';
import { type LedgerEntry, useInvalidateSuppliers } from './queries';

export function ReverseModal({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  const invalidate = useInvalidateSuppliers();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const tooShort = reason.trim().length < 3;

  const reverse = useMutation({
    mutationFn: () => suppliersApi.reverse(entry.id, reason.trim()),
    onSuccess: () => {
      notifyOk('Entry reversed');
      invalidate();
      onClose();
    },
    onError: (e) => notifyApiError(e, 'Could not reverse the entry'),
  });

  return (
    <Modal opened onClose={onClose} title="Reverse entry" size="sm" centered>
      <Stack>
        <Text size="sm">
          Reverse the {LEDGER_TYPE[entry.type].label.toLowerCase()} of{' '}
          <b>{formatPrice(Math.abs(entry.amountP))}</b>? A new opposite entry is added; the original
          stays in the ledger.
        </Text>
        <Textarea
          label="Reason"
          required
          autosize
          minRows={2}
          maxLength={300}
          value={reason}
          error={touched && tooShort ? 'A reason of at least 3 characters is required' : undefined}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={reverse.isPending}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={reverse.isPending}
            onClick={() => {
              setTouched(true);
              if (!tooShort) reverse.mutate();
            }}
          >
            Reverse
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
