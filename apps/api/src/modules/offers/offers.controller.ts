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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CreateOfferDto, RespondOfferDto, UpdateOfferDto } from './offers.dto';
import { OffersService } from './offers.service';

// The path parameter is named `id` (the application's id) so the activity log
// records these writes against the application they belong to.
@ApiTags('offers')
@ApiBearerAuth()
@Controller('applications/:id/offer')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.offer.view)
  get(@Param('id', ParseUUIDPipe) applicationId: string) {
    return this.offers.get(applicationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.offer.create)
  create(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: CreateOfferDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.offers.create(applicationId, dto, actor);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.offer.update)
  update(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offers.update(applicationId, dto);
  }

  @Post('response')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.offer.responseRecord)
  respond(
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: RespondOfferDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.offers.respond(applicationId, dto, actor);
  }
}
