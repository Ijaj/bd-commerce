import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { b2bApi } from './api';
import { type Shop, useInvalidateB2b } from './queries';

export function EditShopModal({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const invalidate = useInvalidateB2b();
  const form = useForm({
    initialValues: {
      name: shop.name,
      ownerName: shop.ownerName ?? '',
      phone: shop.phone,
      address: shop.address,
      area: shop.area ?? '',
      notes: shop.notes ?? '',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      phone: (v) => (v.trim().length >= 5 ? null : 'Enter a phone number'),
      address: (v) => (v.trim() ? null : 'Address is required'),
    },
  });
  const save = useMutation({
    mutationFn: (v: typeof form.values) =>
      b2bApi.updateShop(shop.id, {
        name: v.name.trim(),
        ownerName: v.ownerName.trim() || null,
        phone: v.phone.trim(),
        address: v.address.trim(),
        area: v.area.trim() || null,
        notes: v.notes.trim() || null,
      }),
    onSuccess: () => {
      notifyOk('Shop saved');
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, 'Could not save the shop'),
  });

  return (
    <Modal opened onClose={onClose} title={`Edit shop: ${shop.name}`} centered>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <TextInput label="Shop name" required {...form.getInputProps('name')} />
          <TextInput label="Owner" {...form.getInputProps('ownerName')} />
          <TextInput label="Phone" required {...form.getInputProps('phone')} />
          <TextInput label="Address" required {...form.getInputProps('address')} />
          <TextInput label="Area" {...form.getInputProps('area')} />
          <Textarea label="Internal notes" autosize minRows={2} {...form.getInputProps('notes')} />
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
