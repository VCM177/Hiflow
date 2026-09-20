import { PERMISSIONS } from '@hiflow/shared-types';
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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  CreateRequisitionDto,
  ListRequisitionsQueryDto,
  RejectRequisitionDto,
  UpdateRequisitionDto,
} from './requisitions.dto';
import { RequisitionsService } from './requisitions.service';

@ApiTags('requisitions')
@ApiBearerAuth()
@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitions: RequisitionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.requisition.listView)
  list(
    @Query() query: ListRequisitionsQueryDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.requisition.listView)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.requisitions.get(id, actor);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.requisition.listView)
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.history(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.requisition.create)
  create(@Body() dto: CreateRequisitionDto, @CurrentUser() actor: AuthUser) {
    return this.requisitions.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.requisition.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequisitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.requisition.delete)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.remove(id, actor);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.requisition.submit)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.submit(id, actor);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.requisition.approve)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.approve(id, actor);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.requisition.reject)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequisitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.reject(id, dto.reason, actor);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.requisition.close)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.requisitions.close(id, actor);
  }
}
