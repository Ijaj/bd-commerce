'use client';
import { useEffect, useState } from 'react';
import { Field } from '~/features/account/Field';
import { dict, type Lang } from '~/i18n';
import type { AddressErrors, AddressValue } from './address';
import {
  type District,
  loadDistricts,
  loadDivisions,
  loadUpazilas,
  type Place,
  type Upazila,
} from './geo';
import { SelectField } from './SelectField';

type Props = {
  lang: Lang;
  value: AddressValue;
  errors?: AddressErrors;
  onChange: (patch: Partial<AddressValue>) => void;
  /** Show recipient name + phone (saved addresses and logged-in checkout; guests give theirs above). */
  contact?: boolean;
  /** Show the free-text label ("Home"). */
  withLabel?: boolean;
};

const nameOf = (lang: Lang, p: Place) => (lang === 'bn' && p.nameBn ? p.nameBn : p.nameEn);

/**
 * Recipient + division > district > upazila cascade + street line + landmark.
 * Controlled: the parent owns the value and the validation errors.
 */
export function AddressFields({ lang, value, errors = {}, onChange, contact, withLabel }: Props) {
  const d = dict(lang).checkout;
  const [divisions, setDivisions] = useState<Place[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadDivisions(), loadDistricts()]).then(
      ([dv, ds]) => {
        if (!live) return;
        setDivisions(dv);
        setDistricts(ds);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  // Saved addresses only store the district; derive its division once the lists are in.
  useEffect(() => {
    if (value.divisionId === null && value.districtId !== null && districts.length > 0) {
      const dist = districts.find((x) => x.id === value.districtId);
      if (dist) onChange({ divisionId: dist.divisionId });
    }
  }, [value.divisionId, value.districtId, districts, onChange]);

  useEffect(() => {
    if (value.districtId === null) {
      setUpazilas([]);
      return;
    }
    let live = true;
    loadUpazilas(value.districtId).then(
      (u) => live && setUpazilas(u),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [value.districtId]);

  const opts = (list: Place[]) => list.map((p) => ({ value: p.id, label: nameOf(lang, p) }));
  const num = (v: string) => (v === '' ? null : Number(v));

  return (
    <>
      {contact ? (
        <>
          <Field
            label={d.recipient}
            autoComplete="name"
            value={value.name}
            error={errors.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <Field
            label={d.phone}
            hint={d.phoneHint}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value.phone}
            error={errors.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </>
      ) : null}
      <SelectField
        label={d.division}
        placeholder={divisions.length ? d.selectDivision : d.loadingPlaces}
        options={opts(divisions)}
        value={value.divisionId ?? ''}
        error={errors.divisionId}
        onChange={(e) =>
          onChange({ divisionId: num(e.target.value), districtId: null, upazilaId: null })
        }
      />
      <SelectField
        label={d.district}
        placeholder={d.selectDistrict}
        options={opts(districts.filter((x) => x.divisionId === value.divisionId))}
        value={value.districtId ?? ''}
        disabled={value.divisionId === null}
        error={errors.districtId}
        onChange={(e) => onChange({ districtId: num(e.target.value), upazilaId: null })}
      />
      <SelectField
        label={d.upazila}
        placeholder={d.selectUpazila}
        options={opts(upazilas)}
        value={value.upazilaId ?? ''}
        disabled={value.districtId === null}
        error={errors.upazilaId}
        onChange={(e) => onChange({ upazilaId: num(e.target.value) })}
      />
      {failed ? (
        <span role="alert" style={{ color: 'var(--danger)' }}>
          {dict(lang).checkout.errors.network}
        </span>
      ) : null}
      <Field
        label={d.line}
        hint={d.lineHint}
        autoComplete="street-address"
        value={value.line}
        error={errors.line}
        onChange={(e) => onChange({ line: e.target.value })}
      />
      <Field
        label={d.landmark}
        hint={d.landmarkHint}
        value={value.landmark}
        onChange={(e) => onChange({ landmark: e.target.value })}
      />
      {withLabel ? (
        <Field
          label={d.label}
          hint={d.labelHint}
          maxLength={40}
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      ) : null}
    </>
  );
}
