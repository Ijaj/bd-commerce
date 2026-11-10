import { Select, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from './api';
import type { ShipDraft } from './edit-logic';
import classes from './Orders.module.css';

/** Ship-to fields; changing the district or upazila changes the delivery zone and charge. */
export function OrderEditShip({
  value,
  placeText,
  onChange,
}: {
  value: ShipDraft;
  placeText: string;
  onChange: (next: ShipDraft) => void;
}) {
  const districts = useQuery({
    queryKey: ['geo', 'districts', 'all'],
    queryFn: ordersApi.districts,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const districtId = value.districtId ? Number(value.districtId) : null;
  const upazilas = useQuery({
    queryKey: ['geo', 'upazilas', districtId],
    queryFn: () => ordersApi.upazilas(districtId as number),
    enabled: districtId !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const set = (p: Partial<ShipDraft>) => onChange({ ...value, ...p });
  const opts = (rows?: { id: number; nameEn: string }[]) =>
    (rows ?? []).map((r) => ({ value: String(r.id), label: r.nameEn }));

  return (
    <div className={classes.shipGrid}>
      <TextInput
        label="Name"
        value={value.name}
        onChange={(e) => set({ name: e.currentTarget.value })}
      />
      <TextInput
        label="Phone"
        value={value.phone}
        onChange={(e) => set({ phone: e.currentTarget.value })}
      />
      <Select
        label="District"
        searchable
        data={opts(districts.data)}
        value={value.districtId}
        onChange={(v) => set({ districtId: v, upazilaId: null })}
      />
      <Select
        label="Upazila"
        searchable
        disabled={!value.districtId}
        data={opts(upazilas.data)}
        value={value.upazilaId}
        onChange={(v) => set({ upazilaId: v })}
      />
      <TextInput
        className={classes.span2}
        label="Address line"
        value={value.line}
        onChange={(e) => set({ line: e.currentTarget.value })}
      />
      <TextInput
        className={classes.span2}
        label="Landmark"
        value={value.landmark}
        onChange={(e) => set({ landmark: e.currentTarget.value })}
      />
      <div className={`${classes.span2} ${classes.muted} ${classes.small}`}>Now: {placeText}</div>
    </div>
  );
}
