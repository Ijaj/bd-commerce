import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StaffAuth } from '../auth/staff-auth.guard';
import { NoStore } from '../common/no-store.guard';
import { CurrentCustomer, CustomerAuth } from '../customers/customer-auth.guard';
import type { CustomerAuthContext } from '../customers/customer-session.service';
import { CustomerErrorDto } from '../customers/customers.dto';
import {
  DocInvoiceDetailDto,
  DocInvoiceDto,
  DocInvoiceListDto,
  DocIssueInvoiceDto,
  DocLabelDto,
  DocLabelsRequestDto,
} from './documents.dto';
import { InvoicesService } from './invoices.service';
import { LabelsService } from './labels.service';

/** Admin: invoices need orders.view (read) / shipments.manage (issue); labels shipments.manage. */
@NoStore()
@ApiTags('admin documents')
@Controller('admin')
export class DocumentsAdminController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly labels: LabelsService,
  ) {}

  @Post('orders/:id/invoice')
  @HttpCode(201)
  @StaffAuth('shipments.manage')
  @ApiCreatedResponse({ type: DocInvoiceDto })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND' })
  @ApiConflictResponse({ description: 'INVOICE_NOT_AVAILABLE (cancelled order)' })
  async issue(@Param('id') id: string, @Body() dto: DocIssueInvoiceDto) {
    const order = await this.invoices.resolveOrder(id);
    return this.invoices.issue(order.id, { reissue: dto.reissue ?? false });
  }

  @Get('orders/:id/invoices')
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: DocInvoiceListDto })
  list(@Param('id') id: string) {
    return this.invoices.listForOrder(id);
  }

  @Get('invoices/:id')
  @StaffAuth('orders.view')
  @ApiOkResponse({ type: DocInvoiceDetailDto })
  @ApiNotFoundResponse({ description: 'INVOICE_NOT_FOUND' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.detail(id);
  }

  @Get('shipments/:id/label')
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: DocLabelDto })
  @ApiNotFoundResponse({ description: 'SHIPMENT_NOT_FOUND' })
  label(@Param('id', ParseUUIDPipe) id: string) {
    return this.labels.one(id);
  }

  @Post('shipments/labels')
  @HttpCode(200)
  @StaffAuth('shipments.manage')
  @ApiOkResponse({ type: [DocLabelDto] })
  @ApiNotFoundResponse({ description: 'SHIPMENT_NOT_FOUND (lists missing ids)' })
  bulkLabels(@Body() dto: DocLabelsRequestDto) {
    return this.labels.many(dto.ids);
  }
}

@NoStore()
@ApiTags('customer orders')
@Controller('customer/orders')
export class DocumentsCustomerController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(':orderNo/invoice')
  @CustomerAuth()
  @ApiOkResponse({ type: DocInvoiceDetailDto })
  @ApiNotFoundResponse({ type: CustomerErrorDto })
  @ApiConflictResponse({ description: 'INVOICE_NOT_AVAILABLE' })
  invoice(@CurrentCustomer() ctx: CustomerAuthContext, @Param('orderNo') orderNo: string) {
    return this.invoices.forCustomer(ctx.customer.id, orderNo);
  }
}
