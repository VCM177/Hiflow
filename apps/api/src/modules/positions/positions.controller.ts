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
  @RequirePermissions(PERMISSIONS.position.create)
  create(@Body() dto: CatalogInputDto) {
    return this.positions.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.position.update)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
  ) {
    return this.positions.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.position.delete)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.remove(id);
  }
}
