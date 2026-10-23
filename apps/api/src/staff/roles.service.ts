import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ALL_PERMISSIONS, type PermissionKey } from '../auth/permissions';
import { RbacService } from '../auth/rbac.service';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoleDto, RoleDto, UpdateRoleDto } from './staff.dto';

const roleInclude = {
  permissions: { select: { permissionKey: true } },
  _count: { select: { staff: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

function toDto(r: RoleRow): RoleDto {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.isSystem
      ? [...ALL_PERMISSIONS]
      : r.permissions.map((p) => p.permissionKey).sort(),
    staffCount: r._count.staff,
  };
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async list(): Promise<RoleDto[]> {
    const rows = await this.prisma.role.findMany({
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toDto);
  }

  async create(actor: StaffAuthContext, input: CreateRoleDto): Promise<RoleDto> {
    const permissions = input.permissions as PermissionKey[];
    this.rbac.assertCovers(actor.permissions, permissions, 'Creating this role');
    return this.uniqueName(async () =>
      toDto(
        await this.prisma.role.create({
          data: {
            name: input.name,
            description: input.description,
            permissions: {
              create: [...new Set(permissions)].map((permissionKey) => ({ permissionKey })),
            },
          },
          include: roleInclude,
        }),
      ),
    );
  }

  async update(actor: StaffAuthContext, id: string, input: UpdateRoleDto): Promise<RoleDto> {
    const role = await this.loadEditable(actor, id);
    const permissions = input.permissions as PermissionKey[] | undefined;
    if (permissions)
      this.rbac.assertCovers(actor.permissions, permissions, 'Granting these permissions');
    return this.uniqueName(async () => {
      await this.prisma.$transaction([
        this.prisma.role.update({
          where: { id: role.id },
          data: { name: input.name, description: input.description },
        }),
        ...(permissions
          ? [
              this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
              this.prisma.rolePermission.createMany({
                data: [...new Set(permissions)].map((permissionKey) => ({
                  roleId: id,
                  permissionKey,
                })),
              }),
            ]
          : []),
      ]);
      return toDto(
        await this.prisma.role.findUniqueOrThrow({ where: { id }, include: roleInclude }),
      );
    });
  }

  async remove(actor: StaffAuthContext, id: string): Promise<void> {
    await this.loadEditable(actor, id);
    await this.prisma.role.delete({ where: { id } });
  }

  /** System role is fixed; other roles can only be changed by someone holding all their permissions (Q65). */
  private async loadEditable(actor: StaffAuthContext, id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: roleInclude });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('The Owner role cannot be changed');
    this.rbac.assertCovers(actor.permissions, this.rbac.resolve([role]), 'Changing this role');
    return role;
  }

  private async uniqueName<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A role with that name exists');
      }
      throw err;
    }
  }
}
