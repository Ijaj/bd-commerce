import { Alert, Button, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from '~/i18n';
import { type SrShop, srApi } from './api';
import { BD_PHONE } from './logic';

/** Add a buyer shop from the field (Q119: usable at once, staff review the "New" flag). */
export function AddShopForm({ onCreated }: { onCreated: (shop: SrShop) => void }) {
  const qc = useQueryClient();
  const form = useForm({
    initialValues: { name: '', ownerName: '', phone: '', address: '', area: '' },
    validate: {
      name: (v) => (v.trim() ? null : t('required')),
      ownerName: (v) => (v.trim() ? null : t('required')),
      phone: (v) => (BD_PHONE.test(v.replace(/[\s-]/g, '')) ? null : t('phoneInvalid')),
      address: (v) => (v.trim() ? null : t('required')),
      area: (v) => (v.trim() ? null : t('required')),
    },
  });
  const create = useMutation({
    mutationFn: (v: typeof form.values) =>
      srApi.createShop({
        name: v.name.trim(),
        ownerName: v.ownerName.trim(),
        phone: v.phone.replace(/[\s-]/g, ''),
        address: v.address.trim(),
        area: v.area.trim(),
      }),
    onSuccess: async (shop) => {
      await qc.invalidateQueries({ queryKey: ['sr', 'shops'] });
      onCreated(shop);
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => create.mutate(v))} noValidate>
      <Stack gap="sm">
        {create.error && (
          <Alert color="red" variant="light">
            {create.error.message}
          </Alert>
        )}
        <TextInput
          label={`${t('shopName')} *`}
          placeholder="Rahman General Store"
          {...form.getInputProps('name')}
        />
        <TextInput label={`${t('ownerName')} *`} {...form.getInputProps('ownerName')} />
        <TextInput
          label={`${t('phone')} *`}
          type="tel"
          inputMode="tel"
          placeholder={t('phonePlaceholder')}
          {...form.getInputProps('phone')}
        />
        <Textarea
          label={`${t('address')} *`}
          autosize
          minRows={2}
          {...form.getInputProps('address')}
        />
        <TextInput
          label={`${t('area')} *`}
          placeholder="Mirpur, Dhaka"
          {...form.getInputProps('area')}
        />
        <Button type="submit" fullWidth loading={create.isPending}>
          {t('saveShop')}
        </Button>
      </Stack>
    </form>
  );
}
