import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { deliveryApi } from './api';
import {
  type FreeMode,
  freeAboveFrom,
  freeModeOf,
  gramsToKg,
  type ZoneFormValues,
  zoneBody,
} from './logic';
import { useInvalidateZones, type Zone } from './queries';

/** Create (zone = null) or edit a delivery zone's charges. Coverage has its own dialog. */
export function ZoneModal({ zone, onClose }: { zone: Zone | null; onClose: () => void }) {
  const invalidate = useInvalidateZones();
  const form = useForm<ZoneFormValues>({
    initialValues: {
      nameEn: zone?.nameEn ?? '',
      nameBn: zone?.nameBn ?? '',
      baseChargeP: zone?.baseChargeP ?? null,
      baseWeightKg: zone ? gramsToKg(zone.baseWeightG) : 1,
      extraPerKgP: zone?.extraPerKgP ?? 0,
      etaMinDays: zone?.etaMinDays ?? 1,
      etaMaxDays: zone?.etaMaxDays ?? 3,
      freeMode: zone ? freeModeOf(zone.freeAboveP) : 'never',
      freeAmountP: zone?.freeAboveP ? zone.freeAboveP : null,
      isDefault: zone?.isDefault ?? false,
    },
    validate: {
      nameEn: (v) => (v.trim() ? null : 'Name is required'),
      baseChargeP: (v) => (v === null ? 'Enter the base charge' : null),
      etaMaxDays: (v, all) =>
        Number(v) < Number(all.etaMinDays) ? 'Must not be less than the minimum' : null,
      freeAmountP: (v, all) => {
        const r = freeAboveFrom(all.freeMode, v);
        return 'error' in r ? r.error : null;
      },
    },
  });

  const save = useMutation({
    mutationFn: (v: ZoneFormValues) =>
      zone ? deliveryApi.update(zone.id, zoneBody(v)) : deliveryApi.create(zoneBody(v)),
    onSuccess: () => {
      notifyOk(zone ? 'Zone saved' : 'Zone created');
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, 'Could not save the zone'),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={zone ? `Edit zone: ${zone.nameEn}` : 'Add delivery zone'}
      centered
      size="lg"
    >
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <Group grow align="flex-start">
            <TextInput label="Name (English)" required {...form.getInputProps('nameEn')} />
            <TextInput label="Name (Bangla)" lang="bn" {...form.getInputProps('nameBn')} />
          </Group>
          <Group grow align="flex-start">
            <MoneyInput
              label="Base charge"
              required
              value={form.values.baseChargeP}
              onChange={(p) => form.setFieldValue('baseChargeP', p)}
              error={form.errors.baseChargeP}
            />
            <NumberInput
              label="Base weight (kg)"
              description="Covered by the base charge"
              min={0}
              decimalScale={3}
              {...form.getInputProps('baseWeightKg')}
            />
            <MoneyInput
              label="Extra per kg"
              description="Above the base weight"
              value={form.values.extraPerKgP}
              onChange={(p) => form.setFieldValue('extraPerKgP', p)}
            />
          </Group>
          <Group grow align="flex-start">
            <NumberInput
              label="ETA min (days)"
              min={0}
              max={60}
              allowDecimal={false}
              {...form.getInputProps('etaMinDays')}
            />
            <NumberInput
              label="ETA max (days)"
              min={0}
              max={60}
              allowDecimal={false}
              {...form.getInputProps('etaMaxDays')}
            />
          </Group>

          <div>
            <Text size="sm" fw={500} mb={4}>
              Free delivery
            </Text>
            <SegmentedControl
              fullWidth
              aria-label="Free delivery rule"
              value={form.values.freeMode}
              onChange={(m) => form.setFieldValue('freeMode', m as FreeMode)}
              data={[
                { value: 'never', label: 'Never free' },
                { value: 'above', label: 'Free above an amount' },
                { value: 'always', label: 'Always free' },
              ]}
            />
            {form.values.freeMode === 'above' && (
              <MoneyInput
                mt="xs"
                label="Free when subtotal reaches"
                value={form.values.freeAmountP}
                onChange={(p) => form.setFieldValue('freeAmountP', p)}
                error={form.errors.freeAmountP}
              />
            )}
            <Text size="xs" c="dimmed" mt={4}>
              {form.values.freeMode === 'never' && 'Customers always pay the zone charge.'}
              {form.values.freeMode === 'always' &&
                'Delivery is free for every order in this zone.'}
              {form.values.freeMode === 'above' &&
                'Delivery is free once the order subtotal reaches this amount.'}
            </Text>
          </div>

          <Switch
            label="Default zone"
            description="Used for any district or upazila that no zone covers. Only one zone can be the default."
            {...form.getInputProps('isDefault', { type: 'checkbox' })}
          />
          {form.values.isDefault && zone && !zone.isDefault && (
            <Alert color="yellow" variant="light">
              The current default zone will stop being the default.
            </Alert>
          )}
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {zone ? 'Save' : 'Add zone'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
