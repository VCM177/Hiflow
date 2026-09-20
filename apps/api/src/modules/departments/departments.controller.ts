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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
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
  @RequirePermissions(PERMISSIONS.department.create)
  create(@Body() dto: CatalogInputDto) {
    return this.departments.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.department.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
  ) {
    return this.departments.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.department.delete)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departments.remove(id);
  }
}
