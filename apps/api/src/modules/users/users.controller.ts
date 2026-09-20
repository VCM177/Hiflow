import { PERMISSIONS } from '@hiflow/shared-types';
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  AssignRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  SetStatusDto,
  UpdateUserDto,
} from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.user.listView)
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.user.listView)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.user.create)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.user.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.user.roleAssign)
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.assignRole(id, dto.role, actor);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.user.statusUpdate)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setStatus(id, dto.isActive, actor);
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.user.passwordReset)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.resetPassword(id, dto.newPassword, actor);
  }
}
