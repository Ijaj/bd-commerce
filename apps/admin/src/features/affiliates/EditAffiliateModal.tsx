import { Alert, Button, Group, Modal, Radio, Stack, Textarea, TextInput } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { type AffiliateUpdate, affiliatesApi } from './api';
import { notifyApiError } from './errors';
import { percentToBp } from './logic';
import { type AffiliateDetail, useInvalidateAffiliates } from './queries';

/** Rate override (empty = programme default) and suspend / reactivate. */
export function EditAffiliateModal({
  affiliate: a,
  defaultHint,
  onClose,
}: {
  affiliate: AffiliateDetail;
  defaultHint?: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidateAffiliates();
  const [rate, setRate] = useState(a.rateOverridden ? String(a.commissionBp / 100) : '');
  const [status, setStatus] = useState<'active' | 'suspended'>(a.status);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (b: AffiliateUpdate) => affiliatesApi.update(a.id, b),
    onSuccess: () => {
      notifyOk('Affiliate saved');
      invalidate();
      onClose();
    },
    onError: (e) => notifyApiError(e, 'Could not save the affiliate'),
  });

  function submit() {
    const bp = percentToBp(rate);
    if (bp === 'invalid') return setError('Enter a percentage between 0 and 100, like 7.5.');
    const body: AffiliateUpdate = {};
    const currentBp = a.rateOverridden ? a.commissionBp : null;
    if (bp !== currentBp) body.commissionBp = bp;
    if (status !== a.status) {
      body.status = status;
      if (status === 'suspended') {
        if (!reason.trim()) return setError('Say why you are suspending this affiliate.');
        body.suspendedReason = reason.trim();
      }
    }
    if (Object.keys(body).length === 0) return onClose();
    setError(null);
    save.mutate(body);
  }

  return (
    <Modal opened onClose={onClose} title={`Edit ${a.displayName}`} centered>
      <Stack>
        <TextInput
          label="Commission rate (%)"
          description={`Leave empty to use the programme default${defaultHint ? ` (${defaultHint})` : ''}. Applies to new orders only.`}
          placeholder="Default"
          value={rate}
          onChange={(e) => setRate(e.currentTarget.value)}
          inputMode="decimal"
        />
        <Radio.Group label="Status" value={status} onChange={(v) => setStatus(v as typeof status)}>
          <Group mt={4}>
            <Radio value="active" label="Active" />
            <Radio value="suspended" label="Suspended" />
          </Group>
        </Radio.Group>
        {status === 'suspended' && a.status === 'active' && (
          <>
            <Alert color="yellow" variant="light">
              A suspended affiliate stops earning on new orders. Existing commissions still run and
              can be paid out.
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
          </>
        )}
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
