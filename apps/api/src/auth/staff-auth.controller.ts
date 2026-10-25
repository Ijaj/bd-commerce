import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { ENV, type Env } from '../config/env';
import {
  BackupCodesDto,
  ChangePasswordDto,
  LoginDto,
  LoginResultDto,
  MeDto,
  MfaVerifyDto,
  TotpCodeDto,
  TotpSetupDto,
} from './auth.dto';
import { CurrentStaff, requestMeta, StaffAuth, StaffAuthPendingMfa } from './staff-auth.guard';
import {
  DEVICE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_MS,
  type StaffAuthContext,
  StaffAuthService,
} from './staff-auth.service';

const DEVICE_COOKIE_MS = 400 * 24 * 60 * 60_000;

@ApiTags('staff auth')
@Controller('admin/auth')
export class StaffAuthController {
  constructor(
    private readonly auth: StaffAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private cookie(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    };
  }

  private setDevice(res: Response, deviceToken: string | undefined) {
    if (deviceToken) res.cookie(DEVICE_COOKIE, deviceToken, this.cookie(DEVICE_COOKIE_MS));
  }

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResultDto })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResultDto> {
    const { token, next, deviceToken } = await this.auth.login(
      body.email,
      body.password,
      requestMeta(req, DEVICE_COOKIE),
    );
    res.cookie(SESSION_COOKIE, token, this.cookie(SESSION_MAX_MS));
    this.setDevice(res, deviceToken);
    return { next };
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @StaffAuthPendingMfa()
  @ApiOkResponse({ type: TotpSetupDto })
  setup(@CurrentStaff() ctx: StaffAuthContext): Promise<TotpSetupDto> {
    return this.auth.setupTotp(ctx);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @StaffAuthPendingMfa()
  @ApiOkResponse({ type: BackupCodesDto })
  async enable(
    @CurrentStaff() ctx: StaffAuthContext,
    @Body() body: TotpCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BackupCodesDto> {
    const { backupCodes, deviceToken } = await this.auth.enableTotp(
      ctx,
      body.code,
      requestMeta(req, DEVICE_COOKIE),
    );
    this.setDevice(res, deviceToken);
    return { backupCodes };
  }

  @Post('2fa/verify')
  @HttpCode(204)
  @StaffAuthPendingMfa()
  @ApiNoContentResponse()
  async verify(
    @CurrentStaff() ctx: StaffAuthContext,
    @Body() body: MfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setDevice(res, await this.auth.verifyMfa(ctx, body, requestMeta(req, DEVICE_COOKIE)));
  }

  @Post('logout')
  @HttpCode(204)
  @StaffAuthPendingMfa()
  @ApiNoContentResponse()
  async logout(@CurrentStaff() ctx: StaffAuthContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.revoke(ctx.session.id);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @StaffAuth()
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentStaff() ctx: StaffAuthContext): Promise<MeDto> {
    const roles = await this.auth.rolesOf(ctx.staff.id);
    return {
      id: ctx.staff.id,
      name: ctx.staff.name,
      email: ctx.staff.email,
      roles,
      permissions: [...ctx.permissions].sort(),
    };
  }

  @Post('password')
  @HttpCode(204)
  @StaffAuth()
  @ApiNoContentResponse()
  async changePassword(@CurrentStaff() ctx: StaffAuthContext, @Body() body: ChangePasswordDto) {
    await this.auth.changePassword(ctx, body.currentPassword, body.newPassword);
  }
}
