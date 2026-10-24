import { normalizePhone } from '~/features/account/lib';
import type { CheckoutDict } from './strings.en';

/** Editable address as the forms hold it. Ids are null until chosen. */
export type AddressValue = {
  name: string;
  phone: string;
  divisionId: number | null;
  districtId: number | null;
  upazilaId: number | null;
  line: string;
  landmark: string;
  label: string;
};

export type AddressErrors = Partial<Record<keyof AddressValue, string>>;

export const EMPTY_ADDRESS: AddressValue = {
  name: '',
  phone: '',
  divisionId: null,
  districtId: null,
  upazilaId: null,
  line: '',
  landmark: '',
  label: '',
};

/** Same limits as the API (CreateAddressDto). `contact` = also check recipient name and phone. */
export function validateAddress(
  v: AddressValue,
  e: CheckoutDict['errors'],
  contact: boolean,
): AddressErrors {
  const out: AddressErrors = {};
  if (contact) {
    if (!v.name.trim()) out.name = e.nameRequired;
    if (!normalizePhone(v.phone)) out.phone = e.phoneInvalid;
  }
  if (v.divisionId === null) out.divisionId = e.placeRequired;
  if (v.districtId === null) out.districtId = e.placeRequired;
  if (v.upazilaId === null) out.upazilaId = e.placeRequired;
  if (v.line.trim().length < 3) out.line = e.lineRequired;
  return out;
}

/** Body for POST/PATCH /v1/customer/addresses and the inline `address` of checkout/place. */
export function addressBody(v: AddressValue) {
  return {
    name: v.name.trim(),
    phone: v.phone.trim(),
    districtId: v.districtId as number,
    upazilaId: v.upazilaId as number,
    line: v.line.trim(),
    landmark: v.landmark.trim() || null,
  };
}
