import { Logger } from '@nestjs/common';
import { MailMessage, MailService } from './mail.service';

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8_000;

type FetchFn = typeof fetch;

/** Sends through Resend's HTTPS API (no SMTP port, which Cloud Run does not allow out). */
export class ResendMailService extends MailService {
  private readonly logger = new Logger('Mail');

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchFn: FetchFn = (...args) => fetch(...args),
  ) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    try {
      const response = await this.fetchFn(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        // The status is enough to act on; the body could echo the recipient.
        this.logger.warn(`Resend refused a message (HTTP ${response.status})`);
      }
    } catch (error) {
      this.logger.warn(
        `Could not reach Resend: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
