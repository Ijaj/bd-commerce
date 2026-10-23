import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import {
  AdjustStockDto,
  InventoryListDto,
  InventoryQueryDto,
  InventoryRowDto,
  LowStockCountDto,
  MovementListDto,
  MovementsQueryDto,
  UpdateInventoryDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** One row per variant. Dropship products are listed too; the UI can hint on `fulfillment`. */
  @Get()
  @StaffAuth('inventory.view')
  @ApiOkResponse({ type: InventoryListDto })
  list(@Query() query: InventoryQueryDto) {
    return this.inventory.list(query);
  }

  @Get('low-stock-count')
  @StaffAuth('inventory.view')
  @ApiOkResponse({ type: LowStockCountDto })
  async lowStockCount(): Promise<LowStockCountDto> {
    return { count: await this.inventory.lowStockCount() };
  }

  /** `delta` adds qty (may be negative); `set` sets on-hand to qty. Always writes a ledger row. */
  @Post(':variantId/adjust')
  @HttpCode(200)
  @StaffAuth('inventory.adjust')
  @ApiOkResponse({ type: InventoryRowDto })
  adjust(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: AdjustStockDto,
  ) {
    return this.inventory.adjust(actor.staff.id, variantId, body.mode, body.qty, body.note);
  }

  @Patch(':variantId')
  @StaffAuth('inventory.adjust')
  @ApiOkResponse({ type: InventoryRowDto })
  update(@Param('variantId', ParseUUIDPipe) variantId: string, @Body() body: UpdateInventoryDto) {
    return this.inventory.setThreshold(variantId, body.lowStockThreshold);
  }

  @Get(':variantId/movements')
  @StaffAuth('inventory.view')
  @ApiOkResponse({ type: MovementListDto })
  movements(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query() query: MovementsQueryDto,
  ) {
    return this.inventory.movements(variantId, query);
  }
}
