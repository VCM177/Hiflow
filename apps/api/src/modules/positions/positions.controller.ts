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
import {
  CatalogInputDto,
  CatalogListQueryDto,
  UpdateCatalogDto,
} from '../../common/catalog/catalog.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditEvent } from '../audit/audit.decorators';
import { PositionsService } from './positions.service';

@ApiTags('positions')
@ApiBearerAuth()
@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.position.listView)
  list(@Query() query: CatalogListQueryDto) {
    return this.positions.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.position.listView)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.get(id);
  }

  @Post()
  @AuditEvent('POSITION_CREATED')
  @RequirePermissions(PERMISSIONS.position.create)
  create(@Body() dto: CatalogInputDto, @CurrentUser() actor: AuthUser) {
    return this.positions.create(dto, actor);
  }

  @Patch(':id')
  @AuditEvent('POSITION_UPDATED', { conditional: true })
  @RequirePermissions(PERMISSIONS.position.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.positions.update(id, dto, actor);
  }

  @Delete(':id')
  @AuditEvent('POSITION_DELETED')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.position.delete)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.positions.remove(id, actor);
  }
}
