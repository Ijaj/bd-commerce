import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { RolesService } from './roles.service';
import {
  CreatedStaffDto,
  CreateRoleDto,
  CreateStaffDto,
  PermissionListDto,
  RoleDto,
  RoleListDto,
  StaffDto,
  StaffListDto,
  UpdateRoleDto,
  UpdateStaffDto,
} from './staff.dto';
import { permissionCatalog, StaffService } from './staff.service';

@ApiTags('staff')
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @StaffAuth('staff.view')
  @ApiOkResponse({ type: StaffListDto })
  list(): Promise<StaffDto[]> {
    return this.staff.list();
  }

  /** Returns a one-time temporary password to hand to the new staff member. */
  @Post()
  @StaffAuth('staff.manage')
  @ApiCreatedResponse({ type: CreatedStaffDto })
  create(
    @CurrentStaff() actor: StaffAuthContext,
    @Body() body: CreateStaffDto,
  ): Promise<CreatedStaffDto> {
    return this.staff.create(actor, body);
  }

  @Patch(':id')
  @StaffAuth('staff.manage')
  @ApiOkResponse({ type: StaffDto })
  update(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffDto,
  ): Promise<StaffDto> {
    return this.staff.update(actor, id, body);
  }

  @Post(':id/reset-2fa')
  @HttpCode(200)
  @StaffAuth('staff.manage')
  @ApiOkResponse({ type: StaffDto })
  resetTotp(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffDto> {
    return this.staff.resetTotp(actor, id);
  }
}

@ApiTags('staff')
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @StaffAuth('staff.view')
  @ApiOkResponse({ type: RoleListDto })
  list(): Promise<RoleDto[]> {
    return this.roles.list();
  }

  @Post()
  @StaffAuth('roles.manage')
  @ApiCreatedResponse({ type: RoleDto })
  create(@CurrentStaff() actor: StaffAuthContext, @Body() body: CreateRoleDto): Promise<RoleDto> {
    return this.roles.create(actor, body);
  }

  @Patch(':id')
  @StaffAuth('roles.manage')
  @ApiOkResponse({ type: RoleDto })
  update(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.roles.update(actor, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('roles.manage')
  @ApiNoContentResponse()
  remove(@CurrentStaff() actor: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(actor, id);
  }
}

@ApiTags('staff')
@Controller('admin/permissions')
export class PermissionsController {
  @Get()
  @StaffAuth('staff.view')
  @ApiOkResponse({ type: PermissionListDto })
  list(): PermissionListDto {
    return permissionCatalog();
  }
}
