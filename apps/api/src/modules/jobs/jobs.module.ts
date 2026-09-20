import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { Requisition } from '../requisitions/entities/requisition.entity';
import { Job } from './entities/job.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Job, Requisition, Application])],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
