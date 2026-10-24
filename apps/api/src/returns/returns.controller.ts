import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { NoStore } from '../common/no-store.guard';
import { CurrentCustomer, CustomerAuth } from '../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../customers/customer-session.service';
import { CustomerErrorDto } from '../customers/customers.dto';
import { RefundsService } from './refunds.service';
import {
  ReturnAdminCreateDto,
  ReturnAdminDetailDto,
  ReturnAdminListDto,
  ReturnAdminListQueryDto,
  ReturnApproveDto,
  ReturnCustomerCreateDto,
  ReturnCustomerDto,
  ReturnCustomerListDto,
  ReturnCustomerListQueryDto,
  ReturnInspectDto,
  ReturnNoteDto,
  ReturnOrderRefundDto,
  ReturnRefundCompleteDto,
  ReturnRefundDetailDto,
  ReturnRefundDto,
  ReturnRefundListDto,
  ReturnRefundListQueryDto,
  ReturnRefundRejectDto,
  ReturnRejectDto,
} from './returns.dto';
import { ReturnsService } from './returns.service';

@NoStore()
@ApiTags('customer returns')
@Controller('customer/returns')
export class CustomerReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @HttpCode(201)
  @CustomerAuth()
  @ApiOkResponse({ type: ReturnCustomerDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiConflictResponse({ type: CustomerErrorDto })
  create(@CurrentCustomer() ctx: CustomerAuthContext, @Body() body: ReturnCustomerCreateDto) {
    return this.returns.createForCustomer(ctx.customer.id, body);
  }

  @Get()
  @CustomerAuth()
  @ApiOkResponse({ type: ReturnCustomerListDto })
  list(@CurrentCustomer() ctx: CustomerAuthContext, @Query() q: ReturnCustomerListQueryDto) {
    return this.returns.customerList(ctx.customer.id, q);
  }

  @Get(':returnNo')
  @CustomerAuth()
  @ApiOkResponse({ type: ReturnCustomerDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  detail(@CurrentCustomer() ctx: CustomerAuthContext, @Param('returnNo') returnNo: string) {
    return this.returns.customerDetail(ctx.customer.id, returnNo);
  }
}

/** Reads and workflow need returns.manage; refunds are split: create refunds.manage, approve refunds.approve. */
@ApiTags('returns-admin')
@Controller('admin')
export class ReturnsAdminController {
  constructor(
    private readonly returns: ReturnsService,
    private readonly refunds: RefundsService,
  ) {}

  @Post('orders/:id/returns')
  @HttpCode(201)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  createForOrder(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: ReturnAdminCreateDto,
  ) {
    return this.returns.createForStaff(ctx.staff.id, id, body);
  }

  @Get('returns')
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminListDto })
  list(@Query() q: ReturnAdminListQueryDto) {
    return this.returns.adminList(q);
  }

  @Get('returns/:id')
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.returns.adminDetail(id);
  }

  @Post('returns/:id/approve')
  @HttpCode(200)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  approve(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnApproveDto,
  ) {
    return this.returns.approve(ctx.staff.id, id, body);
  }

  @Post('returns/:id/reject')
  @HttpCode(200)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  reject(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnRejectDto,
  ) {
    return this.returns.reject(ctx.staff.id, id, body.reason);
  }

  @Post('returns/:id/pickup-booked')
  @HttpCode(200)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  pickupBooked(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnNoteDto,
  ) {
    return this.returns.pickupBooked(ctx.staff.id, id, body.note);
  }

  @Post('returns/:id/receive')
  @HttpCode(200)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  receive(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.receive(ctx.staff.id, id);
  }

  @Post('returns/:id/inspect')
  @HttpCode(200)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  inspect(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnInspectDto,
  ) {
    return this.returns.inspect(ctx.staff.id, id, body);
  }

  @Post('returns/:id/close')
  @HttpCode(200)
  @StaffAuth('returns.manage')
  @ApiOkResponse({ type: ReturnAdminDetailDto })
  close(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.returns.close(ctx.staff.id, id);
  }

  @Post('returns/:id/refund')
  @HttpCode(201)
  @StaffAuth('refunds.manage')
  @ApiOkResponse({ type: ReturnRefundDetailDto })
  refundReturn(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnRefundDto,
  ) {
    return this.refunds.createForReturn(ctx.staff.id, id, body);
  }

  @Post('orders/:id/refund')
  @HttpCode(201)
  @StaffAuth('refunds.manage')
  @ApiOkResponse({ type: ReturnRefundDetailDto })
  refundOrder(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id') id: string,
    @Body() body: ReturnOrderRefundDto,
  ) {
    return this.refunds.createForOrder(ctx.staff.id, id, body);
  }

  @Get('refunds')
  @StaffAuth('refunds.manage')
  @ApiOkResponse({ type: ReturnRefundListDto })
  listRefunds(@Query() q: ReturnRefundListQueryDto) {
    return this.refunds.list(q);
  }

  @Get('refunds/:id')
  @StaffAuth('refunds.manage')
  @ApiOkResponse({ type: ReturnRefundDetailDto })
  refund(@Param('id', ParseUUIDPipe) id: string) {
    return this.refunds.detail(id);
  }

  @Post('refunds/:id/approve')
  @HttpCode(200)
  @StaffAuth('refunds.approve')
  @ApiOkResponse({ type: ReturnRefundDetailDto })
  approveRefund(@CurrentStaff() ctx: StaffAuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.refunds.approve(ctx.staff.id, id);
  }

  @Post('refunds/:id/reject')
  @HttpCode(200)
  @StaffAuth('refunds.approve')
  @ApiOkResponse({ type: ReturnRefundDetailDto })
  rejectRefund(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnRefundRejectDto,
  ) {
    return this.refunds.reject(ctx.staff.id, id, body.reason);
  }

  @Post('refunds/:id/complete')
  @HttpCode(200)
  @StaffAuth('refunds.manage')
  @ApiOkResponse({ type: ReturnRefundDetailDto })
  completeRefund(
    @CurrentStaff() ctx: StaffAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReturnRefundCompleteDto,
  ) {
    return this.refunds.complete(ctx.staff.id, id, body.providerRef);
  }
}
