import { Alert, Button, Group, Modal, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '~/api';

const MIN_LENGTH = 12;

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const form = useForm({
    initialValues: { currentPassword: '', newPassword: '', confirm: '' },
    validate: {
      currentPassword: (v) => (v ? null : 'Required'),
      newPassword: (v) => (v.length >= MIN_LENGTH ? null : `At least ${MIN_LENGTH} characters`),
      confirm: (v, all) => (v === all.newPassword ? null : 'Does not match'),
    },
  });
  const change = useMutation({
    mutationFn: (v: { currentPassword: string; newPassword: string }) =>
      unwrap(api.POST('/v1/admin/auth/password', { body: v })),
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Password changed' });
      form.reset();
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Change password" size="sm" centered>
      <form
        onSubmit={form.onSubmit(({ currentPassword, newPassword }) =>
          change.mutate({ currentPassword, newPassword }),
        )}
      >
        <Stack gap="sm">
          {change.error && (
            <Alert color="red" variant="light">
              {change.error.message}
            </Alert>
          )}
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            label="Repeat new password"
            autoComplete="new-password"
            {...form.getInputProps('confirm')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={change.isPending}>
              Change password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
