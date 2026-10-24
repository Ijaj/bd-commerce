import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlaceNames {
  upazila: { nameEn: string; nameBn: string };
  district: { nameEn: string; nameBn: string };
  divisionId: number;
  area: { nameEn: string; nameBn: string } | null;
}

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  divisions() {
    return this.prisma.division.findMany({ orderBy: { nameEn: 'asc' } });
  }

  districts(divisionId?: number) {
    return this.prisma.district.findMany({
      where: divisionId === undefined ? {} : { divisionId },
      orderBy: { nameEn: 'asc' },
    });
  }

  upazilas(districtId: number) {
    return this.prisma.upazila.findMany({ where: { districtId }, orderBy: { nameEn: 'asc' } });
  }

  /** Returns null unless upazila belongs to district and area (if any) belongs to upazila. */
  async resolve(districtId: number, upazilaId: number, areaId?: number | null) {
    const upazila = await this.prisma.upazila.findUnique({
      where: { id: upazilaId },
      include: { district: true, areas: areaId ? { where: { id: areaId } } : false },
    });
    if (!upazila || upazila.districtId !== districtId) return null;
    const area = areaId ? (upazila.areas?.[0] ?? null) : null;
    if (areaId && !area) return null;
    const names: PlaceNames = {
      upazila: upazila,
      district: upazila.district,
      divisionId: upazila.district.divisionId,
      area,
    };
    return names;
  }

  /** "Area, Upazila, District" in the given language (Bangla falls back per part never; dataset has both). */
  placeText(p: PlaceNames, lang: 'en' | 'bn') {
    const pick = (x: { nameEn: string; nameBn: string }) => (lang === 'bn' ? x.nameBn : x.nameEn);
    return [p.area, p.upazila, p.district]
      .filter((x): x is { nameEn: string; nameBn: string } => x !== null)
      .map(pick)
      .join(', ');
  }
}
