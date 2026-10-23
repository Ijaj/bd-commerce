import { Alert, Badge, Button, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { PageHeader } from '~/components/PageHeader';
import { type JsonSchema, SchemaForm } from '~/features/settings/SchemaForm';
import { formatDateTime } from '~/lib/format';
import { useCan } from '~/lib/perm';

export const Route = createFileRoute('/_app/settings')({ component: SettingsPage });

const settingsQuery = {
  queryKey: ['settings'],
  queryFn: () => unwrap(api.GET('/v1/admin/settings')),
};

type Setting = Awaited<ReturnType<typeof settingsQuery.queryFn>>[number];

function SettingCard({ setting, canManage }: { setting: Setting; canManage: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<unknown>(setting.value);
  const dirty = JSON.stringify(draft) !== JSON.stringify(setting.value);
  const done = () => qc.invalidateQueries({ queryKey: ['settings'] });

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PUT('/v1/admin/settings/{key}', {
          params: { path: { key: setting.key } },
          body: { value: draft },
        }),
      ),
    onSuccess: async () => {
      await done();
      notifications.show({ color: 'teal', message: `${setting.key} saved` });
    },
  });
  const reset = useMutation({
    mutationFn: () =>
      unwrap(api.DELETE('/v1/admin/settings/{key}', { params: { path: { key: setting.key } } })),
    onSuccess: async () => {
      await done();
      setDraft(setting.default);
      notifications.show({ color: 'teal', message: `${setting.key} reset to default` });
    },
  });

  return (
    <Paper>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <Group gap="xs">
              <Text fw={600} ff="monospace" size="sm">
                {setting.key}
              </Text>
              {setting.isDefault && (
                <Badge variant="light" color="gray">
                  default
                </Badge>
              )}
              {setting.public && (
                <Badge variant="light" color="teal">
                  public
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {setting.description}
            </Text>
          </div>
          {setting.updatedAt && (
            <Text size="xs" c="dimmed" ta="right">
              {formatDateTime(setting.updatedAt)}
              {setting.updatedBy ? ` by ${setting.updatedBy.name}` : ''}
            </Text>
          )}
        </Group>

        <SchemaForm
          schema={setting.schema as JsonSchema}
          value={draft}
          onChange={setDraft}
          disabled={!canManage}
        />

        {(save.error || reset.error) && (
          <Alert color="red" variant="light">
            {(save.error ?? reset.error)?.message}
          </Alert>
        )}
        {canManage && (
          <Group gap="xs">
            <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
              Save
            </Button>
            {dirty && (
              <Button variant="default" onClick={() => setDraft(setting.value)}>
                Discard
              </Button>
            )}
            {!setting.isDefault && (
              <Button
                variant="subtle"
                color="gray"
                loading={reset.isPending}
                onClick={() => reset.mutate()}
              >
                Reset to default
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

function SettingsPage() {
  const { data, isPending, error } = useQuery(settingsQuery);
  const canManage = useCan('settings.manage');

  if (isPending) return <Loader size="sm" />;
  if (error) return <Alert color="red">{error.message}</Alert>;

  const groups = [...Map.groupBy(data, (s) => s.group)];
  return (
    <>
      <PageHeader
        title="Settings"
        description={
          canManage ? 'Store settings and feature flags.' : 'Read only: you lack settings.manage.'
        }
      />
      <Stack gap="lg">
        {groups.map(([group, items]) => (
          <Stack key={group} gap="sm">
            <Title order={4}>{group}</Title>
            {items.map((s) => (
              // Remount when the server value changes so the draft resets.
              <SettingCard
                key={`${s.key}:${JSON.stringify(s.value)}`}
                setting={s}
                canManage={canManage}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </>
  );
}
