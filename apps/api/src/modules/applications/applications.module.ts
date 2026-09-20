import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Interview } from '../interviews/entities/interview.entity';
import { Job } from '../jobs/entities/job.entity';
import { Offer } from '../offers/entities/offer.entity';
import { User } from '../users/entities/user.entity';
import { ApplicationWorkflowService } from './application-workflow.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { Application } from './entities/application.entity';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationStatusHistory,
      Candidate,
      Job,
      User,
      Interview,
      Offer,
    ]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationWorkflowService],
  exports: [ApplicationWorkflowService],
})
export class ApplicationsModule {}
