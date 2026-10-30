import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';

/** Confirm a destructive PO action with a reason (required or optional). */
export function ReasonModal({
  title,
  description,
  confirmLabel,
  required,
  pending,
  onSubmit,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  required: boolean;
  pending: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const r = reason.trim();
    if (required && r.length < 3) return setError('Give a reason (at least 3 characters).');
    setError(null);
    onSubmit(r);
  }

  return (
    <Modal opened onClose={onClose} title={title} centered>
      <Stack>
        <Text size="sm">{description}</Text>
        <Textarea
          label={required ? 'Reason' : 'Reason (optional)'}
          required={required}
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
            Back
          </Button>
          <Button color="red" loading={pending} onClick={submit}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
