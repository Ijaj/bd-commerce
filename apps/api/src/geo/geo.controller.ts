import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  GeoDistrictListDto,
  GeoDistrictsQueryDto,
  GeoDivisionListDto,
  GeoUpazilaListDto,
  GeoUpazilasQueryDto,
} from './geo.dto';
import { GeoService } from './geo.service';

// Reference data that changes almost never (C33).
const CACHE = 'public, max-age=86400';

@ApiTags('geo')
@Controller('public/geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('divisions')
  @Header('Cache-Control', CACHE)
  @ApiOkResponse({ type: GeoDivisionListDto })
  divisions(): Promise<GeoDivisionListDto> {
    return this.geo.divisions();
  }

  @Get('districts')
  @Header('Cache-Control', CACHE)
  @ApiOkResponse({ type: GeoDistrictListDto })
  districts(@Query() q: GeoDistrictsQueryDto): Promise<GeoDistrictListDto> {
    return this.geo.districts(q.divisionId);
  }

  @Get('upazilas')
  @Header('Cache-Control', CACHE)
  @ApiOkResponse({ type: GeoUpazilaListDto })
  upazilas(@Query() q: GeoUpazilasQueryDto): Promise<GeoUpazilaListDto> {
    return this.geo.upazilas(q.districtId);
  }
}
