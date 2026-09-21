export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text only: a message built from a stranger's input never carries markup. */
  text: string;
}

/**
 * Mail port. `send` never throws: mail is a courtesy, and a mail outage must
 * not fail (or slow down) the request that triggered it. Failures are logged.
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
