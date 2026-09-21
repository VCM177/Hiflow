import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailService } from './mail.service';

const MAX_KEPT = 200;

/**
 * Development and test driver: nothing leaves the machine. Messages are kept in
 * memory so a test can read them back; the log line names the recipient and
 * subject only, because a body may hold a stranger's personal data.
 */
@Injectable()
export class OutboxMailService extends MailService {
  private readonly logger = new Logger('Mail');
  private readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    if (this.messages.length > MAX_KEPT) this.messages.shift();

    this.logger.log(`(outbox) to ${message.to}: ${message.subject}`);
    return Promise.resolve();
  }

  /** Newest last. */
  get sent(): readonly MailMessage[] {
    return this.messages;
  }

  clear(): void {
    this.messages.length = 0;
  }
}
