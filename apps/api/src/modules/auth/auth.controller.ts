import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/throttle/rate-limit.decorator';
import { THROTTLE_POLICY } from '../../common/throttle/throttle.constants';
import type { AuthUser } from '../../common/types/auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Returns the token for API clients and also sets it as a session cookie for
   * the browser. The web app relies on the cookie and does not store the token.
   */
  @Public()
  @RateLimit(THROTTLE_POLICY.LOGIN_IP, THROTTLE_POLICY.LOGIN_ACCOUNT)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto);

    response.cookie(
      SESSION_COOKIE,
      result.accessToken,
      sessionCookieOptions(this.auth.sessionMaxAgeMs(result.accessToken)),
    );

    return result;
  }

  /** Public on purpose: clearing the cookie must work even after the token expired. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  }

  @ApiBearerAuth()
  @ApiCookieAuth(SESSION_COOKIE)
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
