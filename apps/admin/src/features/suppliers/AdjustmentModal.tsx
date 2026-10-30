import {
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { suppliersApi } from './api';
import { notifyApiError } from './errors';
import { type AdjustDirection, adjustmentBody } from './logic';
import { useInvalidateSuppliers } from './queries';

/** Two steps like the B2B adjust: the ledger is append-only, so confirm before posting. */
export function AdjustmentModal({
  supplierId,
  supplierName,
  balanceP,
  onClose,
}: {
  supplierId: string;
  supplierName: string;
  balanceP: number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateSuppliers();
  const [direction, setDirection] = useState<AdjustDirection>('owe_more');
  const [amountP, setAmountP] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<{ amountP: number; note: string } | null>(null);

  const post = useMutation({
    mutationFn: (e: { amountP: number; note: string }) => suppliersApi.adjust(supplierId, e),
    onSuccess: () => {
      notifyOk('Adjustment posted');
      invalidate();
      onClose();
    },
    onError: (e) => notifyApiError(e, 'Could not post the adjustment'),
  });

  function review() {
    const r = adjustmentBody(direction, amountP, note);
    if ('error' in r) return setError(r.error);
    setError(null);
    setEntry(r);
  }

  return (
    <Modal opened onClose={onClose} title={`Adjustment: ${supplierName}`} centered>
      {!entry ? (
        <Stack>
          <Text size="sm">
            Currently owed: <b>{formatPrice(balanceP)}</b>
          </Text>
          <SegmentedControl
            fullWidth
            aria-label="Adjustment direction"
            value={direction}
            onChange={(v) => setDirection(v as AdjustDirection)}
            data={[
              { value: 'owe_more', label: 'We owe more (+)' },
              { value: 'owe_less', label: 'We owe less (−)' },
            ]}
          />
          <MoneyInput label="Amount" required value={amountP} onChange={setAmountP} />
          <Textarea
            label="Reason"
            description="Shown in the ledger. At least 3 characters."
            required
            autosize
            minRows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={review}>Review</Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Text size="sm">
            {entry.amountP > 0 ? 'Add' : 'Remove'} <b>{formatPrice(Math.abs(entry.amountP))}</b>{' '}
            {entry.amountP > 0 ? 'to' : 'from'} what we owe {supplierName}. New balance:{' '}
            <b>{formatPrice(balanceP + entry.amountP)}</b>.
          </Text>
          <Text size="sm" c="dimmed">
            Reason: {entry.note}
          </Text>
          <Text size="xs" c="dimmed">
            Entries cannot be edited. A wrong adjustment can be reversed from the ledger.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEntry(null)} disabled={post.isPending}>
              Back
            </Button>
            <Button loading={post.isPending} onClick={() => post.mutate(entry)}>
              Post adjustment
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
