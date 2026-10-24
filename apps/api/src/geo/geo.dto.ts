import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const place = { id: z.number().int(), nameEn: z.string(), nameBn: z.string() };

export class GeoDivisionListDto extends createZodDto(z.array(z.object(place))) {}

export class GeoDistrictListDto extends createZodDto(
  z.array(z.object({ ...place, divisionId: z.number().int() })),
) {}

export class GeoUpazilaListDto extends createZodDto(
  z.array(z.object({ ...place, districtId: z.number().int() })),
) {}

export class GeoDistrictsQueryDto extends createZodDto(
  z.object({ divisionId: z.coerce.number().int().optional() }),
) {}

export class GeoUpazilasQueryDto extends createZodDto(
  z.object({ districtId: z.coerce.number().int() }),
) {}
