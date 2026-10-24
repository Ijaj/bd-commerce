import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const location = z
  .object({
    districtId: z.number().int().optional(),
    upazilaId: z.number().int().optional(),
    areaId: z.number().int().optional(),
  })
  .refine(
    (v) => [v.districtId, v.upazilaId, v.areaId].filter((x) => x !== undefined).length === 1,
    {
      message: 'Send exactly one of districtId, upazilaId, areaId',
    },
  );

export class LocationDto extends createZodDto(location) {}

const zoneFields = {
  nameEn: z.string().trim().min(1).max(100),
  nameBn: z.string().trim().max(100).nullable().optional(),
  baseChargeP: z.number().int().min(0).max(10_000_000),
  baseWeightG: z.number().int().min(0).max(1_000_000).default(1000),
  extraPerKgP: z.number().int().min(0).max(10_000_000).default(0),
  etaMinDays: z.number().int().min(0).max(60),
  etaMaxDays: z.number().int().min(0).max(60),
  /** null = never free, 0 = always free, else free when subtotal reaches this (Q105). */
  freeAboveP: z.number().int().min(0).nullable().default(null),
  isDefault: z.boolean().default(false),
  sort: z.number().int().default(0),
};

const etaOk = (v: { etaMinDays?: number; etaMaxDays?: number }) =>
  v.etaMinDays === undefined || v.etaMaxDays === undefined || v.etaMinDays <= v.etaMaxDays;

export class CreateZoneDto extends createZodDto(
  z
    .object({ ...zoneFields, locations: z.array(location).max(500).optional() })
    .refine(etaOk, { message: 'etaMinDays must not exceed etaMaxDays' }),
) {}

export class UpdateZoneDto extends createZodDto(
  z
    .object({
      nameEn: zoneFields.nameEn.optional(),
      nameBn: zoneFields.nameBn,
      baseChargeP: z.number().int().min(0).max(10_000_000).optional(),
      baseWeightG: z.number().int().min(0).max(1_000_000).optional(),
      extraPerKgP: z.number().int().min(0).max(10_000_000).optional(),
      etaMinDays: z.number().int().min(0).max(60).optional(),
      etaMaxDays: z.number().int().min(0).max(60).optional(),
      freeAboveP: z.number().int().min(0).nullable().optional(),
      isDefault: z.boolean().optional(),
      sort: z.number().int().optional(),
    })
    .refine(etaOk, { message: 'etaMinDays must not exceed etaMaxDays' }),
) {}

export class ZoneLocationsDto extends createZodDto(
  z.object({ locations: z.array(location).max(500) }),
) {}

export class ZoneDto extends createZodDto(
  z.object({
    id: z.uuid(),
    nameEn: z.string(),
    nameBn: z.string().nullable(),
    baseChargeP: z.number(),
    baseWeightG: z.number(),
    extraPerKgP: z.number(),
    etaMinDays: z.number(),
    etaMaxDays: z.number(),
    freeAboveP: z.number().nullable(),
    isDefault: z.boolean(),
    sort: z.number(),
    orderCount: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    locations: z.array(
      z.object({
        id: z.uuid(),
        level: z.enum(['district', 'upazila', 'area']),
        districtId: z.number().nullable(),
        upazilaId: z.number().nullable(),
        areaId: z.number().nullable(),
        nameEn: z.string(),
        nameBn: z.string(),
      }),
    ),
  }),
) {}

export class ZoneListDto extends createZodDto(z.array(ZoneDto.schema)) {}
