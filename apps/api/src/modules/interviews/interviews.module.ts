import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { User } from '../users/entities/user.entity';
import { Interview } from './entities/interview.entity';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Interview, Application, User])],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
