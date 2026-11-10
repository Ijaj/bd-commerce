import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { NoStore } from '../common/no-store.guard';
import {
  CustomerAdminBlockInputDto,
  CustomerAdminDetailDto,
  CustomerAdminErrorDto,
  CustomerAdminListDto,
  CustomerAdminListQueryDto,
  CustomerAdminNoteDto,
  CustomerAdminNoteInputDto,
  CustomerAdminNoteListDto,
  CustomerAdminOrderListDto,
  CustomerAdminPageQueryDto,
} from './customers-admin.dto';
import { CustomersAdminService } from './customers-admin.service';

/** Customers (A6): GET needs customers.view, notes and block/unblock customers.manage. */
@NoStore()
@ApiTags('customers admin')
@Controller('admin/customers')
export class CustomersAdminController {
  constructor(private readonly svc: CustomersAdminService) {}

  @Get()
  @StaffAuth('customers.view')
  @ApiOkResponse({ type: CustomerAdminListDto })
  list(@Query() q: CustomerAdminListQueryDto) {
    return this.svc.list(q);
  }

  @Get(':id')
  @StaffAuth('customers.view')
  @ApiOkResponse({ type: CustomerAdminDetailDto })
  @ApiNotFoundResponse({ type: CustomerAdminErrorDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.detail(id);
  }

  @Get(':id/orders')
  @StaffAuth('customers.view')
  @ApiOkResponse({ type: CustomerAdminOrderListDto })
  @ApiNotFoundResponse({ type: CustomerAdminErrorDto })
  orders(@Param('id', ParseUUIDPipe) id: string, @Query() q: CustomerAdminPageQueryDto) {
    return this.svc.orders(id, q);
  }

  @Get(':id/notes')
  @StaffAuth('customers.view')
  @ApiOkResponse({ type: CustomerAdminNoteListDto })
  @ApiNotFoundResponse({ type: CustomerAdminErrorDto })
  notes(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.notes(id);
  }

  @Post(':id/notes')
  @StaffAuth('customers.manage')
  @ApiOkResponse({ type: CustomerAdminNoteDto })
  @ApiNotFoundResponse({ type: CustomerAdminErrorDto })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CustomerAdminNoteInputDto,
    @CurrentStaff() ctx: StaffAuthContext,
  ) {
    return this.svc.addNote(id, ctx.staff, body.body);
  }

  @Post(':id/block')
  @HttpCode(200)
  @StaffAuth('customers.manage')
  @ApiOkResponse({ type: CustomerAdminDetailDto })
  @ApiNotFoundResponse({ type: CustomerAdminErrorDto })
  @ApiConflictResponse({ type: CustomerAdminErrorDto })
  block(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CustomerAdminBlockInputDto,
    @CurrentStaff() ctx: StaffAuthContext,
  ) {
    return this.svc.block(id, ctx.staff.id, body.reason);
  }

  @Post(':id/unblock')
  @HttpCode(200)
  @StaffAuth('customers.manage')
  @ApiOkResponse({ type: CustomerAdminDetailDto })
  @ApiNotFoundResponse({ type: CustomerAdminErrorDto })
  @ApiConflictResponse({ type: CustomerAdminErrorDto })
  unblock(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.unblock(id);
  }
}
