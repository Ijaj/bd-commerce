import { Alert, Badge, Button, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { couponsApi } from './api';
import { CodesTab } from './CodesTab';
import { ConditionsSection } from './ConditionsSection';
import { DiscountSection } from './DiscountSection';
import { couponErrorMessage, couponIssues, notifyCouponError } from './errors';
import type { SectionProps } from './fields';
import {
  type CouponFormValues,
  clientIssues,
  emptyValues,
  fromDetail,
  toBody,
  toUpdateBody,
} from './form';
import { IdentitySection } from './IdentitySection';
import { LimitsSection, StackingSection } from './LimitsSection';
import {
  type CouponDetail,
  issueSection,
  PHASE_COLOR,
  PHASE_LABEL,
  type SectionKey,
} from './logic';
import { couponQuery, useInvalidateCoupons } from './queries';
import { ReportTab } from './ReportTab';
import { ScopeSection } from './ScopeSection';

/** Create (no id) or edit (id) a coupon. */
export function CouponEditorPage({ id }: { id?: string }) {
  const detail = useQuery({ ...couponQuery(id ?? ''), enabled: !!id });
  const canManage = useCan('coupons.manage');

  if (!id) {
    return canManage ? (
      <EditorBody detail={null} />
    ) : (
      <Text c="dimmed">You need the coupons.manage permission to create coupons.</Text>
    );
  }
  if (detail.isLoading) return <Loader size="sm" aria-label="Loading" />;
  if (detail.isError || !detail.data) {
    return <Text c="red">{couponErrorMessage(detail.error, 'Could not load the coupon')}</Text>;
  }
  // Re-mount after each save so the form restarts from what the server stored.
  return <EditorBody key={detail.data.updatedAt} detail={detail.data} />;
}

function EditorBody({ detail }: { detail: CouponDetail | null }) {
  const navigate = useNavigate();
  const canManage = useCan('coupons.manage');
  const invalidate = useInvalidateCoupons();
  const initial = detail ? fromDetail(detail) : emptyValues;
  const [v, setV] = useState<CouponFormValues>(initial);
  const [issues, setIssues] = useState<string[]>([]);
  const [lockedByServer, setLockedByServer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isNew = !detail;
  const locked = lockedByServer || (detail?.usesCount ?? 0) > 0;
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const set = (patch: Partial<CouponFormValues>) => {
    setV((p) => ({ ...p, ...patch }));
  };

  const onError = (e: unknown) => {
    const server = couponIssues(e);
    if (server.length > 0) setIssues(server);
    else notifyCouponError(e);
    if ((e as { body?: { code?: string } }).body?.code === 'COUPON_LOCKED') setLockedByServer(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const local = clientIssues(v);
      if (local.length > 0) {
        setIssues(local);
        return null;
      }
      setIssues([]);
      return detail ? couponsApi.update(detail.id, toUpdateBody(v)) : couponsApi.create(toBody(v));
    },
    onSuccess: async (saved) => {
      if (!saved) return;
      await invalidate();
      notifyOk(detail ? 'Coupon saved' : 'Coupon created as a draft');
      if (!detail) navigate({ to: '/promotions/coupons/$id', params: { id: saved.id } });
    },
    onError,
  });

  const act = useMutation({
    mutationFn: async (what: 'activate' | 'pause' | 'duplicate') => {
      if (!detail) return null;
      setIssues([]);
      const r = await couponsApi[what](detail.id);
      return { what, r };
    },
    onSuccess: async (res) => {
      if (!res) return;
      await invalidate();
      if (res.what === 'duplicate') {
        notifyOk('Duplicated as a draft');
        navigate({ to: '/promotions/coupons/$id', params: { id: res.r.id } });
      } else notifyOk(res.what === 'activate' ? 'Coupon activated' : 'Coupon paused');
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: () => couponsApi.remove(detail?.id ?? ''),
    onSuccess: async () => {
      await invalidate();
      notifyOk('Coupon deleted');
      navigate({ to: '/promotions/coupons' });
    },
  });

  const by: Record<SectionKey, string[]> = {
    identity: [],
    discount: [],
    scope: [],
    conditions: [],
    limits: [],
    stacking: [],
  };
  for (const i of issues) by[issueSection(i)].push(i);
  const props = (key: SectionKey): SectionProps => ({
    v,
    set,
    disabled: !canManage,
    locked,
    isNew,
    issues: by[key],
  });

  const form = (
    <Stack gap="md">
      {issues.length > 0 && (
        <Alert color="red" title="The coupon was not saved">
          {issues.map((i) => (
            <div key={i}>{i}</div>
          ))}
        </Alert>
      )}
      <IdentitySection {...props('identity')} />
      <DiscountSection {...props('discount')} />
      <ScopeSection {...props('scope')} />
      <ConditionsSection {...props('conditions')} />
      <LimitsSection {...props('limits')} />
      <StackingSection {...props('stacking')} />
      {canManage && (
        <Group justify="flex-end">
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {isNew ? 'Create coupon' : 'Save changes'}
          </Button>
        </Group>
      )}
    </Stack>
  );

  if (!detail) {
    return (
      <>
        <PageHeader title="New coupon" description="Saved as a draft; activate it when ready." />
        {form}
      </>
    );
  }

  const busy = act.isPending || save.isPending;
  return (
    <>
      <PageHeader
        title={detail.name}
        description={detail.code ? `Code ${detail.code}` : undefined}
        actions={
          <>
            <Badge color={PHASE_COLOR[detail.phase]} variant="light">
              {PHASE_LABEL[detail.phase]}
            </Badge>
            {canManage && (
              <>
                {detail.status === 'active' ? (
                  <Button
                    variant="default"
                    size="xs"
                    disabled={busy}
                    onClick={() => act.mutate('pause')}
                  >
                    Pause
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    disabled={busy || dirty}
                    title={dirty ? 'Save your changes first' : undefined}
                    onClick={() => act.mutate('activate')}
                  >
                    Activate
                  </Button>
                )}
                <Button
                  variant="default"
                  size="xs"
                  disabled={busy || dirty}
                  onClick={() => act.mutate('duplicate')}
                >
                  Duplicate
                </Button>
                <Button color="red" variant="light" size="xs" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </>
            )}
          </>
        }
      />
      <Tabs defaultValue="settings" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
          {canManage && detail.kind === 'code' && detail.isBulk && (
            <Tabs.Tab value="codes">Codes ({detail.codeStats.total})</Tabs.Tab>
          )}
          <Tabs.Tab value="report">Report</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="settings">{form}</Tabs.Panel>
        <Tabs.Panel value="codes">
          <CodesTab coupon={detail} />
        </Tabs.Panel>
        <Tabs.Panel value="report">
          <ReportTab id={detail.id} />
        </Tabs.Panel>
      </Tabs>
      <ConfirmDelete
        opened={deleting}
        onClose={() => setDeleting(false)}
        title="Delete coupon"
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
          } catch (e) {
            throw new Error(couponErrorMessage(e, 'Delete failed'));
          }
        }}
        loading={remove.isPending}
      >
        Delete "{detail.name}"? This cannot be undone. A coupon that was already used cannot be
        deleted; pause it instead.
      </ConfirmDelete>
    </>
  );
}
