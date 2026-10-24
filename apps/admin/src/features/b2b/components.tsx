import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { type ReactNode, useState } from 'react';
import { notifyError } from '~/features/categories/queries';

/** Neutral "are you sure" for non-destructive actions (ConfirmDelete is red and says Delete). */
export function ConfirmAction({
  opened,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  color,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  title: string;
  confirmLabel: string;
  color?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm" centered>
      <Stack>
        <Text size="sm" component="div">
          {children}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            color={color}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                notifyError(e, 'Action failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Asks for a required reason before a reject / reverse. Stays open on error. */
export function ReasonModal({
  opened,
  onClose,
  onSubmit,
  title,
  confirmLabel,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown>;
  title: string;
  confirmLabel: string;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const missing = touched && !reason.trim();

  function close() {
    setReason('');
    setTouched(false);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={close} title={title} size="sm" centered>
      <Stack>
        {children && (
          <Text size="sm" component="div">
            {children}
          </Text>
        )}
        <Textarea
          label="Reason"
          required
          autosize
          minRows={2}
          maxLength={500}
          value={reason}
          error={missing ? 'A reason is required' : undefined}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={busy}
            onClick={async () => {
              setTouched(true);
              if (!reason.trim()) return;
              setBusy(true);
              try {
                await onSubmit(reason.trim());
                close();
              } catch (e) {
                notifyError(e, 'Action failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
