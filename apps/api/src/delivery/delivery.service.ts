import { HttpStatus, Injectable } from '@nestjs/common';
import type { DeliveryZone } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { CommerceError } from '../orders/commerce.errors';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateZoneDto, LocationDto, UpdateZoneDto } from './delivery.dto';

export interface ChargeInput {
  subtotalP: number;
  /** Total parcel weight in grams (lines without a weight count as 0). */
  weightG: number;
  /** Per-product charge overrides present in the order. */
  overridesP: number[];
}

export interface Charge {
  /** Charge before any free-delivery rule. */
  deliveryChargeP: number;
  /** Equals the charge when delivery is free, else 0. */
  deliveryDiscountP: number;
  freeDeliveryRemainingP: number | null;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Most specific zone_locations match wins (area, then upazila, then district), else the default zone. */
  async zoneFor(districtId: number, upazilaId: number, areaId?: number | null) {
    const rows = await this.prisma.zoneLocation.findMany({
      where: {
        OR: [...(areaId ? [{ areaId }] : []), { upazilaId }, { districtId }],
      },
      include: { zone: true },
    });
    const hit =
      rows.find((r) => r.areaId !== null) ??
      rows.find((r) => r.upazilaId !== null) ??
      rows.find((r) => r.districtId !== null);
    if (hit) return hit.zone;
    return this.prisma.deliveryZone.findFirst({ where: { isDefault: true } });
  }

  /**
   * Zone charge = base + ceil(kg above the base weight) × extra-per-kg. One charge per order (Q85):
   * product overrides do not add up; the dearest of the zone charge and any override applies.
   * Free delivery (Q105) waives the whole fee: 0 = always free, null = never, else subtotal ≥ threshold.
   */
  charge(zone: DeliveryZone, input: ChargeInput): Charge {
    const extraKg =
      input.weightG > zone.baseWeightG ? Math.ceil((input.weightG - zone.baseWeightG) / 1000) : 0;
    const zoneCharge = zone.baseChargeP + extraKg * zone.extraPerKgP;
    const deliveryChargeP = Math.max(zoneCharge, ...input.overridesP);
    const free =
      zone.freeAboveP !== null && (zone.freeAboveP === 0 || input.subtotalP >= zone.freeAboveP);
    return {
      deliveryChargeP,
      deliveryDiscountP: free ? deliveryChargeP : 0,
      freeDeliveryRemainingP:
        zone.freeAboveP !== null && zone.freeAboveP > 0 && input.subtotalP < zone.freeAboveP
          ? zone.freeAboveP - input.subtotalP
          : null,
    };
  }

  // ---- admin ----------------------------------------------------------------------------

  private async listShape(zoneIds?: string[]) {
    const zones = await this.prisma.deliveryZone.findMany({
      where: zoneIds ? { id: { in: zoneIds } } : {},
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      include: {
        locations: {
          include: { district: true, upazila: true, area: true },
          orderBy: { id: 'asc' },
        },
        _count: { select: { orders: true } },
      },
    });
    return zones.map(({ locations, _count, ...z }) => ({
      ...z,
      createdAt: z.createdAt.toISOString(),
      updatedAt: z.updatedAt.toISOString(),
      orderCount: _count.orders,
      locations: locations.map((l) => ({
        id: l.id,
        level: l.areaId
          ? ('area' as const)
          : l.upazilaId
            ? ('upazila' as const)
            : ('district' as const),
        districtId: l.districtId,
        upazilaId: l.upazilaId,
        areaId: l.areaId,
        nameEn: (l.area ?? l.upazila ?? l.district)?.nameEn ?? '',
        nameBn: (l.area ?? l.upazila ?? l.district)?.nameBn ?? '',
      })),
    }));
  }

  list() {
    return this.listShape();
  }

  private async one(id: string) {
    const [zone] = await this.listShape([id]);
    if (!zone) throw new CommerceError(HttpStatus.NOT_FOUND, 'ZONE_NOT_FOUND', 'Zone not found.');
    return zone;
  }

  async create(input: CreateZoneDto) {
    const { locations = [], ...data } = input;
    const id = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.deliveryZone.updateMany({ data: { isDefault: false } });
      const zone = await tx.deliveryZone.create({ data });
      await this.addLocations(tx, zone.id, locations);
      return zone.id;
    });
    return this.one(id);
  }

  async update(id: string, input: UpdateZoneDto) {
    const existing = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!existing)
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ZONE_NOT_FOUND', 'Zone not found.');
    if (input.isDefault === false && existing.isDefault) {
      throw new CommerceError(
        HttpStatus.CONFLICT,
        'ZONE_DEFAULT',
        'Make another zone the default instead.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.deliveryZone.updateMany({
          where: { id: { not: id } },
          data: { isDefault: false },
        });
      }
      await tx.deliveryZone.update({ where: { id }, data: input });
    });
    return this.one(id);
  }

  async remove(id: string) {
    const zone = await this.prisma.deliveryZone.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!zone) throw new CommerceError(HttpStatus.NOT_FOUND, 'ZONE_NOT_FOUND', 'Zone not found.');
    if (zone.isDefault) {
      throw new CommerceError(
        HttpStatus.CONFLICT,
        'ZONE_DEFAULT',
        'The default zone cannot be deleted.',
      );
    }
    if (zone._count.orders > 0) {
      throw new CommerceError(HttpStatus.CONFLICT, 'ZONE_IN_USE', 'Orders use this zone.');
    }
    await this.prisma.deliveryZone.delete({ where: { id } });
  }

  async setLocations(id: string, locations: LocationDto[]) {
    await this.one(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.zoneLocation.deleteMany({ where: { zoneId: id } });
      await this.addLocations(tx, id, locations);
    });
    return this.one(id);
  }

  async addMore(id: string, locations: LocationDto[]) {
    await this.one(id);
    await this.prisma.$transaction((tx) => this.addLocations(tx, id, locations));
    return this.one(id);
  }

  async removeLocation(id: string, locationId: string) {
    const res = await this.prisma.zoneLocation.deleteMany({
      where: { id: locationId, zoneId: id },
    });
    if (res.count === 0) {
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ZONE_NOT_FOUND', 'Location not found.');
    }
    return this.one(id);
  }

  private async addLocations(
    tx: Prisma.TransactionClient,
    zoneId: string,
    locations: LocationDto[],
  ) {
    for (const loc of locations) {
      const where =
        loc.areaId !== undefined
          ? { areaId: loc.areaId }
          : loc.upazilaId !== undefined
            ? { upazilaId: loc.upazilaId }
            : { districtId: loc.districtId };
      const taken = await tx.zoneLocation.findFirst({ where, include: { zone: true } });
      if (taken && taken.zoneId !== zoneId) {
        throw new CommerceError(
          HttpStatus.CONFLICT,
          'LOCATION_TAKEN',
          `Already in zone "${taken.zone.nameEn}".`,
          { zoneId: taken.zoneId },
        );
      }
      if (taken) continue;
      try {
        await tx.zoneLocation.create({ data: { zoneId, ...where } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          throw new CommerceError(HttpStatus.BAD_REQUEST, 'LOCATION_INVALID', 'Unknown location.');
        }
        throw e;
      }
    }
  }
}
