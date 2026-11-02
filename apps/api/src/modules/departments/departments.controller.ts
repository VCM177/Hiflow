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
import { DepartmentsService } from './departments.service';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.department.listView)
  list(@Query() query: CatalogListQueryDto) {
    return this.departments.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.department.listView)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.departments.get(id);
  }

  @Post()
  @AuditEvent('DEPARTMENT_CREATED')
  @RequirePermissions(PERMISSIONS.department.create)
  create(@Body() dto: CatalogInputDto, @CurrentUser() actor: AuthUser) {
    return this.departments.create(dto, actor);
  }

  @Patch(':id')
  @AuditEvent('DEPARTMENT_UPDATED', { conditional: true })
  @RequirePermissions(PERMISSIONS.department.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.departments.update(id, dto, actor);
  }

  @Delete(':id')
  @AuditEvent('DEPARTMENT_DELETED')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.department.delete)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.departments.remove(id, actor);
  }
}
