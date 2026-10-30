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
import { MoneyInput } from '~/components/MoneyInput';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { suppliersApi } from './api';
import { notifyApiError } from './errors';
import { overpays, PAY_METHODS, type PayMethod, paymentBody } from './logic';
import { useInvalidateSuppliers } from './queries';

export function PaymentModal({
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
  const [amountP, setAmountP] = useState<number | null>(null);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = useMutation({
    mutationFn: (b: NonNullable<ReturnType<typeof okBody>>) => suppliersApi.pay(supplierId, b),
    onSuccess: () => {
      notifyOk('Payment recorded');
      invalidate();
      onClose();
    },
    onError: (e) => notifyApiError(e, 'Could not record the payment'),
  });

  function okBody() {
    const r = paymentBody({ amountP, method, reference, note });
    return 'error' in r ? null : r;
  }

  function submit() {
    const r = paymentBody({ amountP, method, reference, note });
    if ('error' in r) return setError(r.error);
    setError(null);
    pay.mutate(r);
  }

  return (
    <Modal opened onClose={onClose} title={`Record payment: ${supplierName}`} centered>
      <Stack>
        <Text size="sm">
          Currently owed: <b>{formatPrice(Math.max(balanceP, 0))}</b>
        </Text>
        <MoneyInput label="Amount" required value={amountP} onChange={setAmountP} />
        {overpays(amountP, balanceP) && (
          <Alert color="yellow" variant="light">
            This is more than we owe. It will leave the supplier in credit; that is allowed.
          </Alert>
        )}
        <Select
          label="Method"
          allowDeselect={false}
          value={method}
          onChange={(v) => v && setMethod(v as PayMethod)}
          data={PAY_METHODS.map((m) => ({ value: m.value, label: m.label }))}
        />
        <TextInput
          label="Reference"
          description={
            method === 'cash' ? 'Optional for cash.' : 'Transaction ID or cheque number.'
          }
          required={method !== 'cash'}
          value={reference}
          maxLength={120}
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
            Record payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
