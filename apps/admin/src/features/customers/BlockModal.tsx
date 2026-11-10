import { Alert, Button, Group, Modal, Stack, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { customersApi } from './api';
import { notifyApiError } from './errors';
import { type CustomerDetail, useInvalidateCustomers } from './queries';

/** Block needs a reason (shown to staff only); unblock is a plain confirm. */
export function BlockModal({
  customer: c,
  onClose,
}: {
  customer: CustomerDetail;
  onClose: () => void;
}) {
  const invalidate = useInvalidateCustomers();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = (msg: string) => {
    notifyOk(msg);
    invalidate();
    onClose();
  };
  const block = useMutation({
    mutationFn: (r: string) => customersApi.block(c.id, r),
    onSuccess: () => done('Customer blocked'),
    onError: (e) => {
      notifyApiError(e, 'Could not block the customer');
      invalidate();
    },
  });
  const unblock = useMutation({
    mutationFn: () => customersApi.unblock(c.id),
    onSuccess: () => done('Customer unblocked'),
    onError: (e) => {
      notifyApiError(e, 'Could not unblock the customer');
      invalidate();
    },
  });

  function submitBlock() {
    if (!reason.trim()) return setError('Say why you are blocking this customer.');
    setError(null);
    block.mutate(reason.trim());
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={c.blocked ? `Unblock ${c.name}` : `Block ${c.name}`}
      centered
    >
      <Stack>
        {c.blocked ? (
          <>
            <Alert color="blue" variant="light">
              {c.name} will be able to log in and order again, and their phone can place guest
              orders.
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={unblock.isPending} onClick={() => unblock.mutate()}>
                Unblock
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Alert color="yellow" variant="light">
              A blocked customer is logged out and cannot log in or order. Guest orders from their
              phone number are refused too. The reason stays internal.
            </Alert>
            <Textarea
              label="Reason"
              required
              autosize
              minRows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
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
              <Button color="red" loading={block.isPending} onClick={submitBlock}>
                Block customer
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
