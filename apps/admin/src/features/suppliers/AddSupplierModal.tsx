import { Button, Group, Modal, Select, Stack } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { notifyOk } from '~/features/categories/queries';
import { suppliersApi } from './api';
import { notifyApiError } from './errors';
import { AddressFields, ContactFields, toBody, useSupplierForm } from './form';
import { SHIP_MODE_LABEL, type ShipMode } from './logic';
import { type Supplier, useInvalidateSuppliers } from './queries';

export function AddSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: Supplier) => void;
}) {
  const invalidate = useInvalidateSuppliers();
  const form = useSupplierForm();
  const create = useMutation({
    mutationFn: (v: ReturnType<typeof toBody>) => suppliersApi.create(v),
    onSuccess: (s) => {
      notifyOk('Supplier added');
      invalidate();
      onCreated(s);
    },
    onError: (e) => notifyApiError(e, 'Could not add the supplier'),
  });

  return (
    <Modal opened onClose={onClose} title="Add supplier" size="lg" centered>
      <form onSubmit={form.onSubmit((v) => create.mutate(toBody(v)))}>
        <Stack>
          <ContactFields form={form} />
          <Select
            label="Ship mode"
            allowDeselect={false}
            data={(Object.keys(SHIP_MODE_LABEL) as ShipMode[]).map((m) => ({
              value: m,
              label: SHIP_MODE_LABEL[m],
            }))}
            value={form.values.shipMode}
            onChange={(v) => v && form.setFieldValue('shipMode', v as ShipMode)}
          />
          <AddressFields form={form} />
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Add supplier
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
