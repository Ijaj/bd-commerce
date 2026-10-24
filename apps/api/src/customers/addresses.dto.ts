import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const fields = {
  label: z.string().trim().max(40).nullish(),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30),
  districtId: z.number().int(),
  upazilaId: z.number().int(),
  areaId: z.number().int().nullish(),
  line: z.string().trim().min(3).max(300),
  landmark: z.string().trim().max(200).nullish(),
};

export class CreateAddressDto extends createZodDto(
  z.object({ ...fields, isDefault: z.boolean().optional() }),
) {}

export class UpdateAddressDto extends createZodDto(
  z.object({
    label: fields.label,
    name: fields.name.optional(),
    phone: fields.phone.optional(),
    districtId: fields.districtId.optional(),
    upazilaId: fields.upazilaId.optional(),
    areaId: fields.areaId,
    line: fields.line.optional(),
    landmark: fields.landmark,
  }),
) {}

export class AddressDto extends createZodDto(
  z.object({
    id: z.string(),
    label: z.string().nullable(),
    name: z.string(),
    phone: z.string(),
    districtId: z.number(),
    upazilaId: z.number(),
    areaId: z.number().nullable(),
    line: z.string(),
    landmark: z.string().nullable(),
    isDefault: z.boolean(),
    /// "Upazila, District" in English
    placeText: z.string(),
    /// The same in Bangla
    placeTextBn: z.string(),
  }),
) {}

export class AddressListDto extends createZodDto(z.array(AddressDto.schema)) {}
