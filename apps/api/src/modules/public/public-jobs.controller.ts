import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/throttle/rate-limit.decorator';
import { THROTTLE_POLICY } from '../../common/throttle/throttle.constants';
import { ListPublicJobsQueryDto } from './public-jobs.dto';
import { PublicJobsService } from './public-jobs.service';

/**
 * The job board candidates browse without an account. Read-only, limited per
 * address, and it only ever returns the fields in `PublicJobView`.
 */
@ApiTags('public')
@Public()
@RateLimit(THROTTLE_POLICY.PUBLIC_READ_IP)
@Controller('public/jobs')
export class PublicJobsController {
  constructor(private readonly jobs: PublicJobsService) {}

  @Get()
  list(@Query() query: ListPublicJobsQueryDto) {
    return this.jobs.list(query);
  }

  @Get(':id')
  @ApiNotFoundResponse({
    description: 'Tin không tồn tại hoặc không còn tuyển',
  })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.get(id);
  }
}
