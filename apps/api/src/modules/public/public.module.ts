import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { PublicJobsController } from './public-jobs.controller';
import { PublicJobsService } from './public-jobs.service';

/** Everything an unauthenticated visitor can reach lives here, and only here. */
@Module({
  imports: [TypeOrmModule.forFeature([Job])],
  controllers: [PublicJobsController],
  providers: [PublicJobsService],
})
export class PublicModule {}
