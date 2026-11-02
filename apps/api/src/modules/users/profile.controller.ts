import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditEvent } from '../audit/audit.decorators';
import { ProfileService } from './profile.service';
import { ChangePasswordDto, UpdateProfileDto } from './users.dto';

// No @RequirePermissions: any authenticated user manages their own profile.
@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profile.get(user.id);
  }

  @Patch()
  @AuditEvent('PROFILE_UPDATED', { conditional: true })
  update(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.profile.updateName(user, dto.fullName);
  }

  @Post('change-password')
  @AuditEvent('PASSWORD_CHANGED')
  @HttpCode(204)
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profile.changePassword(user, dto);
  }
}
