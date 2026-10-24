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
  Put,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { StaffAuth } from '../auth/staff-auth.guard';
import {
  CreateZoneDto,
  UpdateZoneDto,
  ZoneDto,
  ZoneListDto,
  ZoneLocationsDto,
} from './delivery.dto';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery zones')
@Controller('admin/delivery-zones')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @StaffAuth('delivery.manage')
  @ApiOkResponse({ type: ZoneListDto })
  list(): Promise<ZoneListDto> {
    return this.delivery.list();
  }

  @Post()
  @StaffAuth('delivery.manage')
  @ApiCreatedResponse({ type: ZoneDto })
  create(@Body() body: CreateZoneDto): Promise<ZoneDto> {
    return this.delivery.create(body);
  }

  @Patch(':id')
  @StaffAuth('delivery.manage')
  @ApiOkResponse({ type: ZoneDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateZoneDto): Promise<ZoneDto> {
    return this.delivery.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffAuth('delivery.manage')
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.delivery.remove(id);
  }

  /** Replaces all locations of the zone. */
  @Put(':id/locations')
  @StaffAuth('delivery.manage')
  @ApiOkResponse({ type: ZoneDto })
  setLocations(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ZoneLocationsDto,
  ): Promise<ZoneDto> {
    return this.delivery.setLocations(id, body.locations);
  }

  /** Adds locations; one that belongs to another zone answers 409 LOCATION_TAKEN. */
  @Post(':id/locations')
  @HttpCode(200)
  @StaffAuth('delivery.manage')
  @ApiOkResponse({ type: ZoneDto })
  addLocations(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ZoneLocationsDto,
  ): Promise<ZoneDto> {
    return this.delivery.addMore(id, body.locations);
  }

  @Delete(':id/locations/:locationId')
  @StaffAuth('delivery.manage')
  @ApiOkResponse({ type: ZoneDto })
  removeLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ): Promise<ZoneDto> {
    return this.delivery.removeLocation(id, locationId);
  }
}
