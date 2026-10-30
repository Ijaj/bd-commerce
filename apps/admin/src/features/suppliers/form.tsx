import { Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { SHIP_MODE_HELP, SHIP_MODE_LABEL, type ShipMode } from './logic';
import type { Supplier } from './queries';
import classes from './suppliers.module.css';

export interface SupplierFormValues {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  shipMode: ShipMode;
  address: string;
  pickupAddress: string;
  paymentTerms: string;
  notes: string;
}

export function supplierFormValues(s?: Supplier): SupplierFormValues {
  return {
    name: s?.name ?? '',
    contactName: s?.contactName ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    shipMode: s?.shipMode ?? 'direct_to_customer',
    address: s?.address ?? '',
    pickupAddress: s?.pickupAddress ?? '',
    paymentTerms: s?.paymentTerms ?? '',
    notes: s?.notes ?? '',
  };
}

export function useSupplierForm(s?: Supplier) {
  return useForm<SupplierFormValues>({
    initialValues: supplierFormValues(s),
    validate: {
      name: (v) => (v.trim() ? null : 'Company name is required'),
      email: (v) => (!v.trim() || /^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Enter a valid email'),
    },
  });
}
export type SupplierForm = ReturnType<typeof useSupplierForm>;

const orNull = (v: string) => v.trim() || null;

/** Form values to the API body: empty text becomes null so cleared fields are cleared. */
export function toBody(v: SupplierFormValues) {
  return {
    name: v.name.trim(),
    contactName: orNull(v.contactName),
    phone: orNull(v.phone),
    email: orNull(v.email),
    shipMode: v.shipMode,
    address: orNull(v.address),
    pickupAddress: orNull(v.pickupAddress),
    paymentTerms: orNull(v.paymentTerms),
    notes: orNull(v.notes),
  };
}

export function ContactFields({ form }: { form: SupplierForm }) {
  return (
    <div className={classes.cols}>
      <TextInput label="Company name" required {...form.getInputProps('name')} />
      <TextInput label="Contact person" {...form.getInputProps('contactName')} />
      <TextInput label="Phone" placeholder="01XXXXXXXXX" {...form.getInputProps('phone')} />
      <TextInput label="Email" type="email" {...form.getInputProps('email')} />
    </div>
  );
}

export function ShipModeRadios({ form }: { form: SupplierForm }) {
  return (
    <div role="radiogroup" aria-label="Ship mode">
      {(Object.keys(SHIP_MODE_LABEL) as ShipMode[]).map((m) => (
        <label key={m} className={classes.radio}>
          <input
            type="radio"
            name="shipMode"
            value={m}
            checked={form.values.shipMode === m}
            onChange={() => form.setFieldValue('shipMode', m)}
          />
          <span>
            <b>{SHIP_MODE_LABEL[m]}</b>
            <div className={`${classes.muted} ${classes.small}`}>{SHIP_MODE_HELP[m]}</div>
          </span>
        </label>
      ))}
    </div>
  );
}

export function AddressFields({ form, full }: { form: SupplierForm; full?: boolean }) {
  return (
    <>
      {full && (
        <Textarea label="Office address" autosize minRows={2} {...form.getInputProps('address')} />
      )}
      <Textarea
        label="Pickup address"
        description="Where couriers collect dropship parcels."
        autosize
        minRows={2}
        {...form.getInputProps('pickupAddress')}
      />
      <TextInput
        label="Payment terms"
        placeholder="e.g. Net 15"
        {...form.getInputProps('paymentTerms')}
      />
    </>
  );
}
