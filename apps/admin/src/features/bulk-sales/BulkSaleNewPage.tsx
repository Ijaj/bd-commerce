import { SectionCard } from '@bdc/ui';
import {
  Alert,
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { MoneyInput } from '~/components/MoneyInput';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { bulkApi } from './api';
import classes from './BulkSales.module.css';
import {
  type BulkForm,
  bulkErrorMessage,
  emptyForm,
  formProblem,
  type Mode,
  toRule,
} from './logic';
import { PreviewPanel } from './PreviewPanel';
import { type BulkPreview, useInvalidateBulk } from './queries';
import { ScopePicker } from './ScopePicker';

export function BulkSaleNewPage() {
  const navigate = useNavigate();
  const canManage = useCan('bulk_sales.manage');
  const invalidate = useInvalidateBulk();
  const [form, setForm] = useState<BulkForm>(emptyForm);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<BulkForm>) => setForm((f) => ({ ...f, ...patch }));
  const problem = formProblem(form);

  // Any edit makes the shown preview stale; applying must follow a preview of the same rule.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every form change
  useEffect(() => setPreview(null), [form]);

  const runPreview = useMutation({
    mutationFn: () => bulkApi.preview(toRule(form)),
    onSuccess: setPreview,
  });
  const apply = useMutation({
    mutationFn: () => bulkApi.apply({ ...toRule(form), name: form.name.trim() }),
    onSuccess: (batch) => {
      notifyOk(`Sale prices set on ${batch.itemCount} variants`);
      invalidate();
      navigate({ to: '/promotions/bulk-sales/$id', params: { id: batch.id } });
    },
  });

  const canApply =
    canManage && !!preview && preview.count > 0 && !preview.tooMany && form.name.trim() !== '';

  return (
    <>
      <PageHeader
        title="New bulk sale"
        crumbs={['Marketing', 'Bulk sales', 'New']}
        description="Sets sale prices on many variants at once. Preview first; you can undo it later."
      />
      <div className={classes.form}>
        <SectionCard title="Discount" bodyClassName={classes.body}>
          <TextInput
            label="Name"
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => set({ name: e.currentTarget.value })}
          />
          <div>
            <Text size="sm" mb={4}>
              Discount
            </Text>
            <Group align="flex-end">
              <SegmentedControl
                value={form.mode}
                onChange={(v) => set({ mode: v as Mode })}
                data={[
                  { value: 'percent', label: 'Percent off' },
                  { value: 'fixed', label: 'Amount off' },
                ]}
              />
              {form.mode === 'percent' ? (
                <NumberInput
                  aria-label="Percent off"
                  suffix="%"
                  min={0.01}
                  max={99.99}
                  decimalScale={2}
                  hideControls
                  w={120}
                  value={form.percent ?? ''}
                  onChange={(v) => set({ percent: v === '' ? null : Number(v) })}
                />
              ) : (
                <MoneyInput
                  aria-label="Amount off"
                  w={140}
                  value={form.valueP}
                  onChange={(v) => set({ valueP: v })}
                />
              )}
            </Group>
          </div>
        </SectionCard>
        <SectionCard title="Applies to" bodyClassName={classes.body}>
          <ScopePicker value={form} onChange={(s) => set(s)} />
        </SectionCard>
        <SectionCard title="Sale window" bodyClassName={classes.body}>
          <Group grow align="flex-start">
            <DateTimePicker
              label="Sale starts"
              description="Empty = right away"
              clearable
              valueFormat="DD MMM YYYY HH:mm"
              value={form.startsAt}
              onChange={(v) => set({ startsAt: v })}
            />
            <DateTimePicker
              label="Sale ends"
              description="Empty = until undone or changed"
              clearable
              valueFormat="DD MMM YYYY HH:mm"
              value={form.endsAt}
              onChange={(v) => set({ endsAt: v })}
            />
          </Group>
          <Switch
            label="Skip variants that are already on sale"
            checked={form.skipExistingSales}
            onChange={(e) => set({ skipExistingSales: e.currentTarget.checked })}
          />
          {runPreview.error && (
            <Alert color="red" role="alert">
              {bulkErrorMessage(runPreview.error)}
            </Alert>
          )}
          <Group>
            <Button
              variant="default"
              disabled={!!problem}
              loading={runPreview.isPending}
              onClick={() => runPreview.mutate()}
            >
              Preview
            </Button>
            {problem && (
              <Text size="xs" c="dimmed">
                {problem}
              </Text>
            )}
          </Group>
        </SectionCard>
        {preview && (
          <SectionCard title="Preview" bodyClassName={classes.body}>
            <PreviewPanel preview={preview} />
          </SectionCard>
        )}
        {apply.error && (
          <Alert color="red" role="alert">
            {bulkErrorMessage(apply.error)}
          </Alert>
        )}
        {canManage && (
          <Group>
            <Button disabled={!canApply} onClick={() => setConfirming(true)}>
              Apply sale prices
            </Button>
            {preview && form.name.trim() === '' && (
              <Text size="xs" c="dimmed">
                Enter a name to apply
              </Text>
            )}
          </Group>
        )}
      </div>
      <ConfirmDelete
        opened={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => apply.mutateAsync()}
        loading={apply.isPending}
        title="Apply bulk sale"
        confirmLabel="Apply"
      >
        This sets sale prices on {preview?.count ?? 0} variants now. You can undo it from the batch
        page.
      </ConfirmDelete>
    </>
  );
}
