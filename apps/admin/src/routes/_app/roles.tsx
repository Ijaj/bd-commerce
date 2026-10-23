import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import {
  type PermissionKey,
  permissionsQuery,
  type RoleRow,
  rolesQuery,
} from '~/features/staff/queries';
import { useCan } from '~/lib/perm';

export const Route = createFileRoute('/_app/roles')({ component: RolesPage });

function RoleModal({
  opened,
  role,
  onClose,
}: {
  opened: boolean;
  /** null = creating */
  role: RoleRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: catalog } = useQuery(permissionsQuery);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [seed, setSeed] = useState<string | null>(null);

  const seedKey = opened ? (role?.id ?? 'new') : null;
  if (seedKey !== seed) {
    setSeed(seedKey);
    if (opened) {
      setName(role?.name ?? '');
      setDescription(role?.description ?? '');
      setPerms(new Set(role?.permissions ?? []));
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description: description.trim() || undefined,
        permissions: [...perms] as PermissionKey[],
      };
      return role
        ? unwrap(
            api.PATCH('/v1/admin/roles/{id}', {
              params: { path: { id: role.id } },
              body: { ...body, description: description.trim() || null },
            }),
          )
        : unwrap(api.POST('/v1/admin/roles', { body }));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['roles'] });
      notifications.show({ color: 'teal', message: role ? 'Role updated' : 'Role created' });
      onClose();
    },
  });

  const groups = [...Map.groupBy(catalog ?? [], (p) => p.group)];
  const locked = role?.isSystem === true;
  const toggle = (keys: string[], on: boolean) =>
    setPerms((prev) => {
      const next = new Set(prev);
      for (const k of keys) on ? next.add(k) : next.delete(k);
      return next;
    });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        save.reset();
        onClose();
      }}
      title={role ? `Edit role: ${role.name}` : 'New role'}
      size="xl"
      centered
    >
      <Stack gap="sm">
        {save.error && (
          <Alert color="red" variant="light">
            {save.error.message}
          </Alert>
        )}
        {locked && (
          <Alert color="indigo" variant="light">
            System role: it always keeps every permission and cannot be renamed.
          </Alert>
        )}
        <TextInput
          label="Name"
          required
          value={name}
          disabled={locked}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Textarea
          label="Description"
          autosize
          minRows={2}
          value={description}
          disabled={locked}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Text size="sm" fw={500}>
          Permissions ({perms.size})
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {groups.map(([group, items]) => {
            const keys = items.map((p) => p.key as string);
            const selected = keys.filter((k) => perms.has(k)).length;
            return (
              <Stack key={group} gap={4}>
                <Checkbox
                  label={group}
                  fw={700}
                  disabled={locked}
                  checked={selected === keys.length}
                  indeterminate={selected > 0 && selected < keys.length}
                  onChange={(e) => toggle(keys, e.currentTarget.checked)}
                />
                {items.map((p) => (
                  <Checkbox
                    key={p.key}
                    ml="md"
                    label={p.description}
                    description={p.key}
                    disabled={locked}
                    checked={perms.has(p.key)}
                    onChange={(e) => toggle([p.key], e.currentTarget.checked)}
                  />
                ))}
              </Stack>
            );
          })}
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          {!locked && (
            <Button loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>
              {role ? 'Save' : 'Create role'}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

function RolesPage() {
  const canManage = useCan('roles.manage');
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery(rolesQuery);
  const [modal, setModal] = useState<{ role: RoleRow | null } | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/v1/admin/roles/{id}', { params: { path: { id } } })),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['roles'] });
      notifications.show({ color: 'teal', message: 'Role deleted' });
    },
  });

  const columns: Column<RoleRow>[] = [
    {
      key: 'name',
      header: 'Role',
      render: (r) => (
        <div>
          <Group gap={6}>
            <Text size="sm" fw={600}>
              {r.name}
            </Text>
            {r.isSystem && (
              <Badge color="indigo" variant="light">
                System
              </Badge>
            )}
          </Group>
          {r.description && (
            <Text size="xs" c="dimmed">
              {r.description}
            </Text>
          )}
        </div>
      ),
    },
    { key: 'perms', header: 'Permissions', align: 'right', render: (r) => r.permissions.length },
    { key: 'staff', header: 'Staff', align: 'right', render: (r) => r.staffCount },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <Button size="compact-xs" variant="default" onClick={() => setModal({ role: r })}>
            {canManage && !r.isSystem ? 'Edit' : 'View'}
          </Button>
          {canManage && !r.isSystem && (
            <Button size="compact-xs" variant="default" color="red" onClick={() => setDeleting(r)}>
              Delete
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a set of permissions. Staff can hold several roles."
        actions={canManage && <Button onClick={() => setModal({ role: null })}>New role</Button>}
      />
      {error ? (
        <Alert color="red">{error.message}</Alert>
      ) : (
        <DataTable columns={columns} rows={data} rowKey={(r) => r.id} loading={isPending} />
      )}
      <RoleModal opened={!!modal} role={modal?.role ?? null} onClose={() => setModal(null)} />
      <ConfirmDelete
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete role"
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
        }}
      >
        Delete role "{deleting?.name}"?{' '}
        {deleting && deleting.staffCount > 0
          ? `${deleting.staffCount} staff member(s) will lose its permissions.`
          : ''}
      </ConfirmDelete>
    </>
  );
}
