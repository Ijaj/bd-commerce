import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { rolesQuery, type StaffRow, staffQuery } from '~/features/staff/queries';
import { formatDateTime } from '~/lib/format';
import { useCan } from '~/lib/perm';

export const Route = createFileRoute('/_app/staff')({ component: StaffPage });

function useRoleOptions() {
  const { data } = useQuery({ ...rolesQuery, enabled: true });
  return (data ?? []).map((r) => ({ value: r.id, label: r.name }));
}

function CreateStaffModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: (r: { name: string; email: string; tempPassword: string }) => void;
}) {
  const qc = useQueryClient();
  const roles = useRoleOptions();
  const form = useForm({
    initialValues: { name: '', email: '', phone: '', roleIds: [] as string[] },
    validate: {
      name: (v) => (v.trim() ? null : 'Required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
    },
  });
  const create = useMutation({
    mutationFn: (v: typeof form.values) =>
      unwrap(
        api.POST('/v1/admin/staff', {
          body: {
            name: v.name,
            email: v.email,
            phone: v.phone.trim() || undefined,
            roleIds: v.roleIds,
          },
        }),
      ),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['staff'] });
      await qc.invalidateQueries({ queryKey: ['roles'] });
      form.reset();
      onClose();
      onCreated({ name: r.staff.name, email: r.staff.email, tempPassword: r.tempPassword });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Add staff member" centered>
      <form onSubmit={form.onSubmit((v) => create.mutate(v))}>
        <Stack gap="sm">
          {create.error && (
            <Alert color="red" variant="light">
              {create.error.message}
            </Alert>
          )}
          <TextInput label="Name" required {...form.getInputProps('name')} />
          <TextInput label="Email" type="email" required {...form.getInputProps('email')} />
          <TextInput label="Phone" {...form.getInputProps('phone')} />
          <MultiSelect label="Roles" data={roles} searchable {...form.getInputProps('roleIds')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function TempPasswordModal({
  info,
  onClose,
}: {
  info: { name: string; email: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={!!info}
      onClose={onClose}
      title="Temporary password"
      centered
      closeOnClickOutside={false}
    >
      {info && (
        <Stack gap="sm">
          <Text size="sm">
            Give this to {info.name} ({info.email}). It is shown only once; they must change it at
            first sign-in.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <Code fz="md" p="xs" style={{ flex: 1, userSelect: 'all' }}>
              {info.tempPassword}
            </Code>
            <CopyButton value={info.tempPassword}>
              {({ copied, copy }) => (
                <Button variant="default" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end">
            <Button onClick={onClose}>Done</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function EditStaffModal({ staff, onClose }: { staff: StaffRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const roles = useRoleOptions();
  const form = useForm({
    initialValues: {
      name: '',
      phone: '',
      roleIds: [] as string[],
      disabled: false,
      sessionTimeoutMin: '' as number | '',
    },
    validate: { name: (v) => (v.trim() ? null : 'Required') },
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (staff && staff.id !== loadedId) {
    setLoadedId(staff.id);
    form.setValues({
      name: staff.name,
      phone: staff.phone ?? '',
      roleIds: staff.roles.map((r) => r.id),
      disabled: staff.disabled,
      sessionTimeoutMin: staff.sessionTimeoutMin ?? '',
    });
    form.resetDirty();
  }

  const close = () => {
    setLoadedId(null);
    update.reset();
    onClose();
  };

  const update = useMutation({
    mutationFn: (v: typeof form.values) =>
      unwrap(
        api.PATCH('/v1/admin/staff/{id}', {
          params: { path: { id: staff?.id ?? '' } },
          body: {
            name: v.name,
            phone: v.phone.trim() || null,
            roleIds: v.roleIds,
            disabled: v.disabled,
            sessionTimeoutMin: v.sessionTimeoutMin === '' ? null : v.sessionTimeoutMin,
          },
        }),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['staff'] });
      await qc.invalidateQueries({ queryKey: ['roles'] });
      notifications.show({ color: 'teal', message: 'Staff updated' });
      close();
    },
  });

  return (
    <Modal opened={!!staff} onClose={close} title={staff ? `Edit ${staff.email}` : ''} centered>
      <form onSubmit={form.onSubmit((v) => update.mutate(v))}>
        <Stack gap="sm">
          {update.error && (
            <Alert color="red" variant="light">
              {update.error.message}
            </Alert>
          )}
          <TextInput label="Name" required {...form.getInputProps('name')} />
          <TextInput label="Phone" {...form.getInputProps('phone')} />
          <MultiSelect label="Roles" data={roles} searchable {...form.getInputProps('roleIds')} />
          <NumberInput
            label="Idle session timeout (minutes)"
            description="Empty = store default"
            min={5}
            max={1440}
            {...form.getInputProps('sessionTimeoutMin')}
          />
          <Switch
            label="Account disabled"
            {...form.getInputProps('disabled', { type: 'checkbox' })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function StaffPage() {
  const canManage = useCan('staff.manage');
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery(staffQuery);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);
  const [temp, setTemp] = useState<{ name: string; email: string; tempPassword: string } | null>(
    null,
  );

  const reset2fa = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/v1/admin/staff/{id}/reset-2fa', { params: { path: { id } } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['staff'] });
      notifications.show({
        color: 'teal',
        message: '2FA reset. They set it up again at next sign-in.',
      });
    },
  });

  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <div>
          <Text size="sm" fw={600}>
            {s.name}
          </Text>
          <Text size="xs" c="dimmed">
            {s.email}
          </Text>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (s) => (
        <Group gap={4}>
          {s.roles.map((r) => (
            <Badge key={r.id} variant="light">
              {r.name}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Group gap={4}>
          {s.disabled ? <Badge color="red">Disabled</Badge> : <Badge color="teal">Active</Badge>}
          <Badge variant="outline" color={s.totpEnabled ? 'teal' : 'gray'}>
            {s.totpEnabled ? '2FA on' : '2FA pending'}
          </Badge>
        </Group>
      ),
    },
    { key: 'last', header: 'Last sign-in', render: (s) => formatDateTime(s.lastLoginAt) },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <Button size="compact-xs" variant="default" onClick={() => setEditing(s)}>
            Edit
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            disabled={!s.totpEnabled}
            onClick={() => setResetting(s)}
          >
            Reset 2FA
          </Button>
        </Group>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title="Staff"
        description="People who can sign in to this admin."
        actions={canManage && <Button onClick={() => setCreating(true)}>Add staff</Button>}
      />
      {error ? (
        <Alert color="red">{error.message}</Alert>
      ) : (
        <DataTable columns={columns} rows={data} rowKey={(s) => s.id} loading={isPending} />
      )}
      <CreateStaffModal opened={creating} onClose={() => setCreating(false)} onCreated={setTemp} />
      <TempPasswordModal info={temp} onClose={() => setTemp(null)} />
      <EditStaffModal staff={editing} onClose={() => setEditing(null)} />
      <ConfirmDelete
        opened={!!resetting}
        onClose={() => setResetting(null)}
        title="Reset two-factor"
        confirmLabel="Reset 2FA"
        onConfirm={async () => {
          if (resetting) await reset2fa.mutateAsync(resetting.id);
        }}
      >
        Reset 2FA for {resetting?.name}? Their sessions end and they must set up an authenticator
        again at next sign-in.
      </ConfirmDelete>
    </>
  );
}
