import { HttpStatus, Injectable } from '@nestjs/common';
import type { CustomerAddress } from '../generated/prisma/client';
import { GeoService } from '../geo/geo.service';
import { CommerceError } from '../orders/commerce.errors';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAddressDto, UpdateAddressDto } from './addresses.dto';
import { normalizePhone } from './phone';

const MAX_ADDRESSES = 10;

type WithPlace = CustomerAddress & {
  upazila: { nameEn: string; nameBn: string };
  district: { nameEn: string; nameBn: string };
};

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  private shape(a: WithPlace) {
    return {
      id: a.id,
      label: a.label,
      name: a.name,
      phone: a.phone,
      districtId: a.districtId,
      upazilaId: a.upazilaId,
      areaId: a.areaId,
      line: a.line,
      landmark: a.landmark,
      isDefault: a.isDefault,
      placeText: `${a.upazila.nameEn}, ${a.district.nameEn}`,
      placeTextBn: `${a.upazila.nameBn}, ${a.district.nameBn}`,
    };
  }

  private readonly include = { upazila: true, district: true } as const;

  async list(customerId: string) {
    const rows = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: this.include,
    });
    return rows.map((r) => this.shape(r));
  }

  private async validPhone(raw: string) {
    const phone = normalizePhone(raw);
    if (!phone) {
      throw new CommerceError(
        HttpStatus.BAD_REQUEST,
        'ADDRESS_INVALID',
        'Enter a valid Bangladesh mobile number.',
      );
    }
    return phone;
  }

  private async assertPlace(districtId: number, upazilaId: number, areaId?: number | null) {
    if (!(await this.geo.resolve(districtId, upazilaId, areaId))) {
      throw new CommerceError(
        HttpStatus.BAD_REQUEST,
        'ADDRESS_INVALID',
        'That location is not valid.',
      );
    }
  }

  async create(customerId: string, input: CreateAddressDto) {
    const phone = await this.validPhone(input.phone);
    await this.assertPlace(input.districtId, input.upazilaId, input.areaId);
    const id = await this.prisma.$transaction(async (tx) => {
      const count = await tx.customerAddress.count({ where: { customerId } });
      if (count >= MAX_ADDRESSES) {
        throw new CommerceError(
          HttpStatus.CONFLICT,
          'ADDRESS_LIMIT',
          `At most ${MAX_ADDRESSES} addresses.`,
        );
      }
      const makeDefault = input.isDefault === true || count === 0;
      if (makeDefault) {
        await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      const row = await tx.customerAddress.create({
        data: {
          customerId,
          label: input.label ?? null,
          name: input.name,
          phone,
          districtId: input.districtId,
          upazilaId: input.upazilaId,
          areaId: input.areaId ?? null,
          line: input.line,
          landmark: input.landmark ?? null,
          isDefault: makeDefault,
        },
      });
      return row.id;
    });
    return this.one(customerId, id);
  }

  private async one(customerId: string, id: string) {
    const row = await this.prisma.customerAddress.findFirst({
      where: { id, customerId },
      include: this.include,
    });
    if (!row) {
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ADDRESS_NOT_FOUND', 'Address not found.');
    }
    return this.shape(row);
  }

  async update(customerId: string, id: string, input: UpdateAddressDto) {
    const current = await this.prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!current) {
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ADDRESS_NOT_FOUND', 'Address not found.');
    }
    const districtId = input.districtId ?? current.districtId;
    const upazilaId = input.upazilaId ?? current.upazilaId;
    const areaId = input.areaId === undefined ? current.areaId : input.areaId;
    // Moving to another upazila without naming an area drops the old area.
    const areaFixed = input.upazilaId !== undefined && input.areaId === undefined ? null : areaId;
    await this.assertPlace(districtId, upazilaId, areaFixed);
    await this.prisma.customerAddress.update({
      where: { id },
      data: {
        label: input.label === undefined ? undefined : input.label,
        name: input.name,
        phone: input.phone === undefined ? undefined : await this.validPhone(input.phone),
        districtId,
        upazilaId,
        areaId: areaFixed,
        line: input.line,
        landmark: input.landmark === undefined ? undefined : input.landmark,
      },
    });
    return this.one(customerId, id);
  }

  async setDefault(customerId: string, id: string) {
    await this.one(customerId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      await tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
    });
    return this.one(customerId, id);
  }

  async remove(customerId: string, id: string) {
    const row = await this.prisma.customerAddress.findFirst({ where: { id, customerId } });
    if (!row) {
      throw new CommerceError(HttpStatus.NOT_FOUND, 'ADDRESS_NOT_FOUND', 'Address not found.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({ where: { id } });
      if (row.isDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
        });
        if (next)
          await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }
}
