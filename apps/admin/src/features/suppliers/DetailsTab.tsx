import { SectionCard } from '@bdc/ui';
import { Button, Group, Stack, Textarea } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { suppliersApi } from './api';
import { notifyApiError } from './errors';
import {
  AddressFields,
  ContactFields,
  ShipModeRadios,
  supplierFormValues,
  toBody,
  useSupplierForm,
} from './form';
import { type Supplier, useInvalidateSuppliers } from './queries';
import classes from './suppliers.module.css';

export function DetailsTab({ supplier, canManage }: { supplier: Supplier; canManage: boolean }) {
  const invalidate = useInvalidateSuppliers();
  const form = useSupplierForm(supplier);

  // Pick up server changes (pause/reactivate, saves from another tab) without losing edits in progress.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to a new server copy
  useEffect(() => {
    if (!form.isDirty()) form.setValues(supplierFormValues(supplier));
  }, [supplier]);

  const save = useMutation({
    mutationFn: (v: ReturnType<typeof toBody>) => suppliersApi.update(supplier.id, v),
    onSuccess: (s) => {
      notifyOk('Supplier saved');
      form.setInitialValues(supplierFormValues(s));
      form.resetDirty();
      invalidate();
    },
    onError: (e) => notifyApiError(e, 'Could not save the supplier'),
  });

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(toBody(v)))}>
      <fieldset disabled={!canManage} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <SectionCard title="Contact" className="a-gap">
          <ContactFields form={form} />
        </SectionCard>
        <SectionCard title="Ship mode" className="a-gap">
          <ShipModeRadios form={form} />
        </SectionCard>
        <SectionCard title="Address and terms" className="a-gap">
          <Stack>
            <AddressFields form={form} full />
            <Textarea
              label="Internal notes"
              autosize
              minRows={2}
              {...form.getInputProps('notes')}
            />
          </Stack>
        </SectionCard>
      </fieldset>
      {canManage && (
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            disabled={!form.isDirty()}
            onClick={() => form.setValues(supplierFormValues(supplier))}
          >
            Discard changes
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!form.isDirty()}>
            Save changes
          </Button>
        </Group>
      )}
      <p className={`${classes.muted} ${classes.small}`}>
        Portal users, on-time performance and the dropship queue arrive with step 7b.
      </p>
    </form>
  );
}
