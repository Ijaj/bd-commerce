import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';

export interface ConfirmDeleteProps {
  opened: boolean;
  onClose: () => void;
  /** Runs on confirm; closes on success. A thrown error is shown as a notification and keeps the modal open. */
  onConfirm: () => Promise<unknown> | unknown;
  title?: string;
  /** Body text, e.g. what will be deleted and what happens to related data. */
  children?: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}

/**
 * Controlled "are you sure" dialog for destructive actions.
 *   <ConfirmDelete opened={!!target} onClose={() => setTarget(null)} onConfirm={() => del(target.id)}>
 *     Delete brand "Acme"?
 *   </ConfirmDelete>
 */
export function ConfirmDelete({
  opened,
  onClose,
  onConfirm,
  title = 'Delete',
  children,
  confirmLabel = 'Delete',
  loading,
}: ConfirmDeleteProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm" centered>
      <Stack gap="md">
        <Text size="sm" component="div">
          {children ?? 'This cannot be undone.'}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={loading}
            onClick={async () => {
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                // Stay open so the user can retry; show why it failed.
                notifications.show({
                  color: 'red',
                  message: e instanceof Error ? e.message : 'Delete failed',
                });
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
