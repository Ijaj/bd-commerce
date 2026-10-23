import { ForbiddenException, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_PERMISSIONS, OWNER_ROLE, PERMISSIONS, type PermissionKey } from './permissions';

@Injectable()
export class RbacService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  /** Syncs the code catalog into `permissions` and makes sure the Owner role exists. */
  async onApplicationBootstrap() {
    await this.prisma.$transaction([
      ...Object.entries(PERMISSIONS).map(([key, p]) =>
        this.prisma.permission.upsert({
          where: { key },
          create: { key, group: p.group, description: p.description },
          update: { group: p.group, description: p.description },
        }),
      ),
      this.prisma.permission.deleteMany({ where: { key: { notIn: ALL_PERMISSIONS } } }),
      this.prisma.role.upsert({
        where: { name: OWNER_ROLE },
        create: { name: OWNER_ROLE, description: 'Full access', isSystem: true },
        update: { isSystem: true },
      }),
    ]);
  }

  /** Union of the staff member's role permissions (Q64); a system role grants everything. */
  async permissionsOf(staffId: string): Promise<Set<PermissionKey>> {
    const roles = await this.prisma.role.findMany({
      where: { staff: { some: { staffId } } },
      select: { isSystem: true, permissions: { select: { permissionKey: true } } },
    });
    return this.resolve(roles);
  }

  resolve(roles: { isSystem: boolean; permissions: { permissionKey: string }[] }[]) {
    if (roles.some((r) => r.isSystem)) return new Set(ALL_PERMISSIONS);
    return new Set(
      roles.flatMap((r) => r.permissions.map((p) => p.permissionKey as PermissionKey)),
    );
  }

  /** Q65: staff can only grant (or act on someone holding) permissions they hold themselves. */
  assertCovers(actor: Set<PermissionKey>, wanted: Iterable<PermissionKey>, what: string) {
    const missing = [...wanted].filter((k) => !actor.has(k));
    if (missing.length) {
      throw new ForbiddenException(
        `${what} needs permissions you don't have: ${missing.join(', ')}`,
      );
    }
  }
}
