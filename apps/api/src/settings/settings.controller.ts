import { Body, Controller, Delete, Get, Header, HttpCode, Param, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff, StaffAuth } from '../auth/staff-auth.guard';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { SetSettingDto, SettingListDto, SiteStatusDto } from './settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @StaffAuth('settings.view')
  @ApiOkResponse({ type: SettingListDto })
  list(): Promise<SettingListDto> {
    return this.settings.listForAdmin() as Promise<SettingListDto>;
  }

  @Put(':key')
  @HttpCode(204)
  @StaffAuth('settings.manage')
  @ApiNoContentResponse()
  async set(
    @CurrentStaff() actor: StaffAuthContext,
    @Param('key') key: string,
    @Body() body: SetSettingDto,
  ) {
    await this.settings.set(key, body.value, actor.staff.id);
  }

  /** Back to the code default. */
  @Delete(':key')
  @HttpCode(204)
  @StaffAuth('settings.manage')
  @ApiNoContentResponse()
  async reset(@Param('key') key: string) {
    await this.settings.reset(key);
  }
}

@ApiTags('public')
@Controller('public/site')
export class SiteController {
  constructor(private readonly settings: SettingsService) {}

  /** Maintenance, announcement bar and feature flags for the shop and apps. */
  @Get()
  @Header('Cache-Control', 'public, max-age=30')
  @ApiOkResponse({ type: SiteStatusDto })
  async status(): Promise<SiteStatusDto> {
    const s = await this.settings.all();
    const bar = s.announcement_bar;
    const now = new Date().toISOString();
    const showBar =
      bar.enabled && (!bar.startsAt || bar.startsAt <= now) && (!bar.endsAt || now < bar.endsAt);
    return {
      maintenance: s.maintenance_mode,
      announcement: showBar ? { text: bar.text, link: bar.link } : null,
      contact: s.shop_contact,
      flags: {
        online_payments_enabled: s.online_payments_enabled,
        advance_payments_enabled: s.advance_payments_enabled,
        preorders_enabled: s.preorders_enabled,
      },
    };
  }
}
