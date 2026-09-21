import type { MailMessage } from './mail.service';

interface ApplicationMailData {
  to: string;
  fullName: string;
  jobTitle: string;
}

// Plain text on purpose: the name comes from a stranger, and a mail client
// renders text as text, so nothing they type can become markup or a link.
const SIGNATURE = '\n\nTrân trọng,\nBộ phận Tuyển dụng Hiflow';

/** Keeps a stranger's text on one line, so it cannot add paragraphs of its own. */
const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** First submission: the candidate learns it arrived. */
export const applicationReceivedMail = ({
  to,
  fullName,
  jobTitle,
}: ApplicationMailData): MailMessage => ({
  to,
  subject: `Hiflow đã nhận hồ sơ ứng tuyển: ${oneLine(jobTitle)}`,
  text:
    `Xin chào ${oneLine(fullName)},\n\n` +
    `Chúng tôi đã nhận được hồ sơ ứng tuyển của bạn cho vị trí "${oneLine(jobTitle)}". ` +
    'Bộ phận Tuyển dụng sẽ xem xét và liên hệ với bạn nếu hồ sơ phù hợp.' +
    SIGNATURE,
});

/**
 * The address was already used for this job. Only the owner of the mailbox
 * learns that: the website answers everyone the same way, so a stranger cannot
 * use the form to find out who applied where.
 */
export const alreadyAppliedMail = ({
  to,
  fullName,
  jobTitle,
}: ApplicationMailData): MailMessage => ({
  to,
  subject: `Bạn đã ứng tuyển vị trí này rồi: ${oneLine(jobTitle)}`,
  text:
    `Xin chào ${oneLine(fullName)},\n\n` +
    `Hồ sơ của bạn cho vị trí "${oneLine(jobTitle)}" đã được ghi nhận trước đó, ` +
    'nên chúng tôi không tạo thêm hồ sơ mới. Bạn không cần làm gì thêm.\n\n' +
    'Nếu bạn không thực hiện việc này, vui lòng bỏ qua thư.' +
    SIGNATURE,
});
