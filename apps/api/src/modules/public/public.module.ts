import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { MailModule } from '../mail/mail.module';
import { PublicJobsController } from './public-jobs.controller';
import { PublicJobsService } from './public-jobs.service';
import { TurnstileService } from './turnstile.service';

/** Everything an unauthenticated visitor can reach lives here, and only here. */
@Module({
  imports: [TypeOrmModule.forFeature([Job]), MailModule],
  controllers: [PublicJobsController],
  providers: [
    PublicJobsService,
    {
      provide: TurnstileService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new TurnstileService(config.get<string>('TURNSTILE_SECRET')),
    },
  ],
})
export class PublicModule {}
