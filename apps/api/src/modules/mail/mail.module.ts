import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { OutboxMailService } from './outbox-mail.service';
import { ResendMailService } from './resend-mail.service';

/**
 * MAIL_DRIVER=resend sends real mail; the default, "outbox", only records it in
 * memory (development and tests). Production refuses to boot without Resend.
 */
export function createMail(config: ConfigService): MailService {
  return config.get<string>('MAIL_DRIVER') === 'resend'
    ? new ResendMailService(
        config.getOrThrow<string>('RESEND_API_KEY'),
        config.getOrThrow<string>('MAIL_FROM'),
      )
    : new OutboxMailService();
}

@Module({
  providers: [
    { provide: MailService, inject: [ConfigService], useFactory: createMail },
  ],
  exports: [MailService],
})
export class MailModule {}
