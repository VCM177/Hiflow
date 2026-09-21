import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { Job } from '../jobs/entities/job.entity';
import { MailModule } from '../mail/mail.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { PublicApplicationsController } from './public-applications.controller';
import { PublicApplicationsService } from './public-applications.service';
import { PublicJobsController } from './public-jobs.controller';
import { PublicJobsService } from './public-jobs.service';
import { TurnstileService } from './turnstile.service';

/** Everything an unauthenticated visitor can reach lives here, and only here. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    ApplicationsModule,
    MailModule,
    StorageModule,
    UsersModule,
  ],
  controllers: [PublicJobsController, PublicApplicationsController],
  providers: [
    PublicJobsService,
    PublicApplicationsService,
    {
      provide: TurnstileService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new TurnstileService(config.get<string>('TURNSTILE_SECRET')),
    },
  ],
})
export class PublicModule {}
