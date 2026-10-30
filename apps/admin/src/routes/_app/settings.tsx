import { SectionCard } from '@bdc/ui';
import { Alert, Badge, Button, Group, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { api, unwrap } from '~/api';
import { PageHeader } from '~/components/PageHeader';
import { type JsonSchema, prettify, SchemaForm } from '~/features/settings/SchemaForm';
import classes from '~/features/settings/settings.module.css';
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
      notifications.show({ color: 'teal', message: `${prettify(setting.key)} saved` });
    },
  });
  const reset = useMutation({
    mutationFn: () =>
      unwrap(api.DELETE('/v1/admin/settings/{key}', { params: { path: { key: setting.key } } })),
    onSuccess: async () => {
      await done();
      setDraft(setting.default);
      notifications.show({ color: 'teal', message: `${prettify(setting.key)} reset to default` });
    },
  });

  return (
    <div className={classes.row} data-setting={setting.key}>
      <div className={classes.head}>
        <div className={classes.title}>
          <span className={classes.key}>
            {prettify(setting.key)}
            {setting.isDefault && <Badge color="gray">default</Badge>}
            {setting.public && <Badge color="green">public</Badge>}
          </span>
          <span className={classes.desc}>{setting.description}</span>
        </div>
        {setting.updatedAt && (
          <span className={classes.meta}>
            {formatDateTime(setting.updatedAt)}
            {setting.updatedBy ? ` by ${setting.updatedBy.name}` : ''}
          </span>
        )}
      </div>

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
            <Button variant="subtle" loading={reset.isPending} onClick={() => reset.mutate()}>
              Reset to default
            </Button>
          )}
        </Group>
      )}
    </div>
  );
}

function SettingsPage() {
  const { data, isPending, error } = useQuery(settingsQuery);
  const canManage = useCan('settings.manage');

  if (isPending)
    return (
      <>
        <PageHeader title="Settings" crumbs={['Admin', 'System', 'Settings']} />
        <SectionCard>
          <div className={classes.loading} role="status" aria-label="Loading">
            <Loader size="sm" />
          </div>
        </SectionCard>
      </>
    );
  if (error)
    return (
      <>
        <PageHeader title="Settings" crumbs={['Admin', 'System', 'Settings']} />
        <Alert color="red">{error.message}</Alert>
      </>
    );

  const groups = [...Map.groupBy(data, (s) => s.group)];
  return (
    <>
      <PageHeader
        title="Settings"
        crumbs={['Admin', 'System', 'Settings']}
        description={
          canManage ? 'Store settings and feature flags.' : 'Read only: you lack settings.manage.'
        }
      />
      <div className={classes.groups}>
        {groups.map(([group, items]) => (
          <SectionCard key={group} title={group}>
            {items.map((s) => (
              // Remount when the server value changes so the draft resets.
              <SettingCard
                key={`${s.key}:${JSON.stringify(s.value)}`}
                setting={s}
                canManage={canManage}
              />
            ))}
          </SectionCard>
        ))}
      </div>
    </>
  );
}
