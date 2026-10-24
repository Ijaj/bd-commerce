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
import { notifyError, notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { b2bApi } from './api';
import { type AdjustDirection, signedAdjustment } from './logic';
import { type Shop, useInvalidateB2b } from './queries';

/** Two steps: fill in the entry, then confirm it. The ledger is append-only, so there is no undo. */
export function AdjustModal({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const invalidate = useInvalidateB2b();
  const [direction, setDirection] = useState<AdjustDirection>('increase');
  const [amountP, setAmountP] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [entry, setEntry] = useState<{ amountP: number; note: string } | null>(null);

  const post = useMutation({
    mutationFn: (e: { amountP: number; note: string }) => b2bApi.adjust(shop.id, e),
    onSuccess: () => {
      notifyOk('Adjustment posted');
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, 'Could not post the adjustment'),
  });

  function review() {
    const r = signedAdjustment(direction, amountP, note);
    if ('error' in r) return setError(r.error);
    setError(null);
    setEntry(r);
    setStep('confirm');
  }

  return (
    <Modal opened onClose={onClose} title={`Adjust due: ${shop.name}`} centered>
      {step === 'form' || !entry ? (
        <Stack>
          <Text size="sm">
            Current due: <b>{formatPrice(shop.dueBalanceP)}</b>
          </Text>
          <SegmentedControl
            fullWidth
            aria-label="Adjustment direction"
            value={direction}
            onChange={(v) => setDirection(v as AdjustDirection)}
            data={[
              { value: 'increase', label: 'Increase due' },
              { value: 'reduce', label: 'Reduce due' },
            ]}
          />
          <MoneyInput label="Amount" required value={amountP} onChange={setAmountP} />
          <Textarea
            label="Note"
            description="Why this adjustment is needed. Visible in the ledger."
            required
            autosize
            minRows={2}
            maxLength={500}
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
            {entry.amountP > 0 ? 'to' : 'from'} what {shop.name} owes. New due:{' '}
            <b>{formatPrice(shop.dueBalanceP + entry.amountP)}</b>.
          </Text>
          <Text size="sm" c="dimmed">
            Note: {entry.note}
          </Text>
          <Text size="xs" c="dimmed">
            The ledger cannot be edited afterwards; fix mistakes with another adjustment.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setStep('form')} disabled={post.isPending}>
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
