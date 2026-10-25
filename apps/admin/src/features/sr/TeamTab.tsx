import { Banner } from '@bdc/ui';
import { Alert, Badge, Button, Group, Modal, NumberInput, Stack, TextInput } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { srApi } from './api';
import { bpToPercent, formatPercent, percentToBp } from './logic';
import { type Profile, profilesQuery, useInvalidateSr } from './queries';

function ProfileModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const invalidate = useInvalidateSr();
  const [area, setArea] = useState(profile.area ?? '');
  const [pct, setPct] = useState<number | string>(bpToPercent(profile.commissionBp));
  const save = useMutation({
    mutationFn: () =>
      srApi.updateProfile(profile.staffId, {
        area: area.trim() || null,
        commissionBp: percentToBp(pct),
      }),
    onSuccess: () => {
      notifyOk('SR profile saved');
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, 'Could not save the profile'),
  });
  return (
    <Modal opened onClose={onClose} title={`Edit SR: ${profile.name}`} centered>
      <Stack>
        <TextInput label="Area" value={area} onChange={(e) => setArea(e.currentTarget.value)} />
        <NumberInput
          label="Commission (%)"
          description={`Leave empty to use the store default (${formatPercent(profile.effectiveCommissionBp)} now).`}
          min={0}
          max={100}
          decimalScale={2}
          value={pct}
          onChange={setPct}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TeamTab() {
  const list = useQuery(profilesQuery);
  const [editing, setEditing] = useState<Profile | null>(null);

  const columns: Column<Profile>[] = [
    {
      key: 'name',
      header: 'SR',
      render: (p) => (
        <div className="a-row">
          <span className="a-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{p.name}</b>
            <span className="sub">{p.email}</span>
          </div>
        </div>
      ),
    },
    { key: 'area', header: 'Area', render: (p) => p.area ?? '-' },
    {
      key: 'rate',
      header: 'Commission',
      align: 'right',
      render: (p) => (
        <Group gap={6} justify="flex-end">
          {formatPercent(p.effectiveCommissionBp)}
          {p.commissionBp === null && (
            <Badge size="xs" color="gray">
              default
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: 'status',
      header: 'Account',
      render: (p) => (
        <Badge size="sm" color={p.disabled ? 'red' : 'green'}>
          {p.disabled ? 'Disabled' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <Button size="compact-sm" onClick={() => setEditing(p)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <Banner tone="info" icon="info">
        Staff holding the sales rep role. Add a person under Staff and give them the SR role to see
        them here.
      </Banner>
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(p) => p.staffId}
        loading={list.isLoading}
        emptyMessage="No sales reps yet."
      />
      {editing && (
        <ProfileModal key={editing.staffId} profile={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
