import { SectionCard } from '@bdc/ui';
import { Alert, Button, Group, Switch } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import { isoToLocal, localToIso } from '~/features/carousel/logic';
import { notifyOk } from '~/features/categories/queries';
import { flashApi } from './api';
import classes from './FlashSales.module.css';
import { flashErrorMessage } from './logic';
import type { FlashDetail } from './queries';
import { useInvalidateFlash } from './queries';

interface Values {
  nameEn: string;
  nameBn: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export function validateSaleValues(v: Values) {
  const errors: Partial<Record<keyof Values, string>> = {};
  if (!v.nameEn.trim()) errors.nameEn = 'Enter a name';
  if (!v.startsAt) errors.startsAt = 'Pick a start time';
  if (!v.endsAt) errors.endsAt = 'Pick an end time';
  const s = localToIso(v.startsAt);
  const e = localToIso(v.endsAt);
  if (s && e && Date.parse(e) <= Date.parse(s)) errors.endsAt = 'Must be after the start';
  return errors;
}

/** Name, window and active flag. Creating returns the new id so the page can move on to items. */
export function SaleDetailsForm({
  sale,
  canManage,
  onCreated,
}: {
  sale?: FlashDetail;
  canManage: boolean;
  onCreated?: (id: string) => void;
}) {
  const invalidate = useInvalidateFlash();
  const form = useForm<Values>({
    initialValues: {
      nameEn: sale?.nameEn ?? '',
      nameBn: sale?.nameBn ?? '',
      startsAt: isoToLocal(sale?.startsAt ?? null),
      endsAt: isoToLocal(sale?.endsAt ?? null),
      isActive: sale?.isActive ?? true,
    },
    validate: validateSaleValues,
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        nameEn: v.nameEn.trim(),
        nameBn: v.nameBn.trim() || null,
        startsAt: localToIso(v.startsAt) as string,
        endsAt: localToIso(v.endsAt) as string,
        isActive: v.isActive,
      };
      return sale ? flashApi.update(sale.id, body) : flashApi.create(body);
    },
    onSuccess: (saved) => {
      notifyOk(sale ? 'Flash sale saved' : 'Flash sale created');
      invalidate();
      if (!sale) onCreated?.(saved.id);
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))} className={classes.formWrap}>
      <SectionCard title="Sale" bodyClassName={classes.form}>
        <BilingualTextInput
          label="Name"
          required
          value={{ en: form.values.nameEn, bn: form.values.nameBn }}
          onChange={(v) => {
            form.setFieldValue('nameEn', v.en);
            form.setFieldValue('nameBn', v.bn);
          }}
          error={{ en: form.errors.nameEn as string | undefined }}
          disabled={!canManage}
          maxLength={120}
        />
        <Group grow align="flex-start">
          <DateTimePicker
            label="Starts at"
            required
            valueFormat="DD MMM YYYY HH:mm"
            disabled={!canManage}
            {...form.getInputProps('startsAt')}
          />
          <DateTimePicker
            label="Ends at"
            required
            valueFormat="DD MMM YYYY HH:mm"
            disabled={!canManage}
            {...form.getInputProps('endsAt')}
          />
        </Group>
        <Switch
          label="Active"
          description="Inactive sales never go live, whatever their dates."
          disabled={!canManage}
          {...form.getInputProps('isActive', { type: 'checkbox' })}
        />
        {save.error && (
          <Alert color="red" role="alert">
            {flashErrorMessage(save.error)}
          </Alert>
        )}
        {canManage && (
          <Group>
            <Button type="submit" loading={save.isPending}>
              {sale ? 'Save details' : 'Create flash sale'}
            </Button>
          </Group>
        )}
      </SectionCard>
    </form>
  );
}
