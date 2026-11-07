import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { affiliatesApi } from './api';
import { errorCode, notifyApiError } from './errors';
import { detailLines, PAYOUT_METHODS, type PayoutMethod, payoutBody } from './logic';
import { type DueRow, useInvalidateAffiliates } from './queries';

/** Record a payout for everything approved and unpaid; the amount is sent so a stale total is refused. */
export function MarkPaidModal({ due, onClose }: { due: DueRow; onClose: () => void }) {
  const invalidate = useInvalidateAffiliates();
  const [method, setMethod] = useState<PayoutMethod>(due.payoutMethod ?? 'cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = useMutation({
    mutationFn: (b: NonNullable<ReturnType<typeof okBody>>) =>
      affiliatesApi.pay(due.affiliateId, b),
    onSuccess: () => {
      notifyOk('Payout recorded');
      invalidate();
      onClose();
    },
    onError: (e) => {
      notifyApiError(e, 'Could not record the payout');
      // A changed / emptied balance: reload the due list so the new total shows, close the stale form.
      const code = errorCode(e);
      if (
        code === 'AFFILIATE_PAYOUT_CHANGED' ||
        code === 'AFFILIATE_NOTHING_DUE' ||
        code === 'AFFILIATE_BELOW_MIN'
      ) {
        invalidate();
        onClose();
      }
    },
  });

  function okBody() {
    const r = payoutBody({ method, reference, note, expectedAmountP: due.balanceP });
    return 'error' in r ? null : r;
  }

  function submit() {
    const r = payoutBody({ method, reference, note, expectedAmountP: due.balanceP });
    if ('error' in r) return setError(r.error);
    setError(null);
    pay.mutate(r);
  }

  const lines = detailLines(due.payoutDetails);
  return (
    <Modal opened onClose={onClose} title={`Mark paid: ${due.displayName}`} centered>
      <Stack>
        <Text size="sm">
          Pay <b>{formatPrice(due.balanceP)}</b> for {due.commissionCount} approved commission
          {due.commissionCount === 1 ? '' : 's'}.
        </Text>
        {lines.length > 0 ? (
          <Text size="sm">Pay to: {lines.join(' · ')}</Text>
        ) : (
          <Alert color="yellow" variant="light">
            This affiliate has not saved payout details yet.
          </Alert>
        )}
        <Select
          label="Method"
          allowDeselect={false}
          value={method}
          onChange={(v) => v && setMethod(v as PayoutMethod)}
          data={PAYOUT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
        />
        <TextInput
          label="Reference"
          description="Transaction ID, cheque number or receipt."
          required
          value={reference}
          maxLength={100}
          onChange={(e) => setReference(e.currentTarget.value)}
        />
        <Textarea
          label="Note"
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
          <Button loading={pay.isPending} onClick={submit}>
            Confirm paid
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
