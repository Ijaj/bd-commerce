import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashPassword, newTempPassword } from '../auth/password';
import { OWNER_ROLE, PERMISSIONS, type PermissionKey } from '../auth/permissions';
import { RbacService } from '../auth/rbac.service';
import { type StaffAuthContext, StaffAuthService } from '../auth/staff-auth.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStaffDto, StaffDto, UpdateStaffDto } from './staff.dto';

const withRoles = {
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          isSystem: true,
          permissions: { select: { permissionKey: true } },
        },
      },
    },
  },
} satisfies Prisma.StaffInclude;

type StaffWithRoles = Prisma.StaffGetPayload<{ include: typeof withRoles }>;

function toDto(s: StaffWithRoles): StaffDto {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    disabled: s.disabledAt !== null,
    totpEnabled: s.totpEnabledAt !== null,
    sessionTimeoutMin: s.sessionTimeoutMin,
    lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    roles: s.roles.map(({ role }) => ({ id: role.id, name: role.name })),
  };
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly auth: StaffAuthService,
  ) {}

  async list(): Promise<StaffDto[]> {
    const rows = await this.prisma.staff.findMany({ include: withRoles, orderBy: { name: 'asc' } });
    return rows.map(toDto);
  }

  async create(actor: StaffAuthContext, input: CreateStaffDto) {
    await this.assertRolesGrantable(actor.permissions, input.roleIds);
    return this.insert(input.name, input.email, input.phone, input.roleIds);
  }

  /** First account on a fresh install (server CLI). */
  async createOwner(email: string, name: string) {
    const owner = await this.prisma.role.findUniqueOrThrow({ where: { name: OWNER_ROLE } });
    return this.insert(name, email, undefined, [owner.id]);
  }

  async update(actor: StaffAuthContext, id: string, input: UpdateStaffDto): Promise<StaffDto> {
    const target = await this.load(id);
    this.rbac.assertCovers(
      actor.permissions,
      this.rbac.resolve(target.roles.map((r) => r.role)),
      'Editing this staff member',
    );

    if (input.disabled === true && id === actor.staff.id) {
      throw new BadRequestException("You can't disable yourself");
    }
    if (input.roleIds) await this.assertRolesGrantable(actor.permissions, input.roleIds);

    const losesOwner =
      target.roles.some((r) => r.role.isSystem) &&
      (input.disabled === true ||
        (input.roleIds !== undefined && !(await this.includesSystemRole(input.roleIds))));
    if (losesOwner) await this.assertAnotherOwner(id);

    await this.prisma.$transaction([
      this.prisma.staff.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone,
          sessionTimeoutMin: input.sessionTimeoutMin,
          ...(input.disabled !== undefined && {
            disabledAt: input.disabled ? (target.disabledAt ?? new Date()) : null,
          }),
        },
      }),
      ...(input.roleIds
        ? [
            this.prisma.staffRole.deleteMany({ where: { staffId: id } }),
            this.prisma.staffRole.createMany({
              data: input.roleIds.map((roleId) => ({ staffId: id, roleId })),
            }),
          ]
        : []),
    ]);
    if (input.disabled === true) await this.auth.revokeAll(id);
    return toDto(await this.load(id));
  }

  /** C14: clears 2FA and backup codes, signs the person out; they set up 2FA again at next login. */
  async resetTotp(actor: StaffAuthContext | null, id: string): Promise<StaffDto> {
    const target = await this.load(id);
    if (actor) {
      if (id === actor.staff.id) throw new BadRequestException("You can't reset your own 2FA");
      this.rbac.assertCovers(
        actor.permissions,
        this.rbac.resolve(target.roles.map((r) => r.role)),
        'Resetting 2FA for this staff member',
      );
    }
    await this.prisma.$transaction([
      this.prisma.staff.update({
        where: { id },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
          totpLastStep: null,
          totpResetAt: new Date(),
          totpResetById: actor?.staff.id ?? null,
        },
      }),
      this.prisma.staffBackupCode.deleteMany({ where: { staffId: id } }),
    ]);
    await this.auth.revokeAll(id);
    return toDto(await this.load(id));
  }

  async findIdByEmail(email: string) {
    const row = await this.prisma.staff.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!row) throw new NotFoundException('No staff with that email');
    return row.id;
  }

  private async insert(
    name: string,
    emailInput: string,
    phone: string | undefined,
    roleIds: string[],
  ) {
    const tempPassword = newTempPassword();
    try {
      const staff = await this.prisma.staff.create({
        data: {
          name,
          email: emailInput.trim().toLowerCase(),
          phone,
          passwordHash: await hashPassword(tempPassword),
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include: withRoles,
      });
      return { staff: toDto(staff), tempPassword };
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException('A staff member with that email exists');
      throw err;
    }
  }

  private async load(id: string) {
    const row = await this.prisma.staff.findUnique({ where: { id }, include: withRoles });
    if (!row) throw new NotFoundException('Staff member not found');
    return row;
  }

  private async assertRolesGrantable(actor: Set<PermissionKey>, roleIds: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { isSystem: true, permissions: { select: { permissionKey: true } } },
    });
    if (roles.length !== new Set(roleIds).size) throw new BadRequestException('Unknown role');
    this.rbac.assertCovers(actor, this.rbac.resolve(roles), 'Assigning these roles');
  }

  private async includesSystemRole(roleIds: string[]) {
    return (await this.prisma.role.count({ where: { id: { in: roleIds }, isSystem: true } })) > 0;
  }

  private async assertAnotherOwner(exceptId: string) {
    const others = await this.prisma.staff.count({
      where: {
        id: { not: exceptId },
        disabledAt: null,
        roles: { some: { role: { isSystem: true } } },
      },
    });
    if (others === 0) throw new BadRequestException('At least one active Owner must remain');
  }
}

export const permissionCatalog = () =>
  Object.entries(PERMISSIONS).map(([key, p]) => ({ key: key as PermissionKey, ...p }));
