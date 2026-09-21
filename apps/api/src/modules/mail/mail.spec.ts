import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { alreadyAppliedMail, applicationReceivedMail } from './mail-templates';
import { createMail } from './mail.module';
import { OutboxMailService } from './outbox-mail.service';
import { ResendMailService } from './resend-mail.service';

const message = {
  to: 'ung.vien@example.com',
  subject: 'Chủ đề',
  text: 'Nội dung',
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('OutboxMailService', () => {
  it('keeps what it was asked to send, newest last, and clears on request', async () => {
    const outbox = new OutboxMailService();

    await outbox.send({ ...message, subject: 'một' });
    await outbox.send({ ...message, subject: 'hai' });
    expect(outbox.sent.map((m) => m.subject)).toEqual(['một', 'hai']);

    outbox.clear();
    expect(outbox.sent).toHaveLength(0);
  });

  it('does not grow without bound', async () => {
    const outbox = new OutboxMailService();

    for (let i = 0; i < 250; i++)
      await outbox.send({ ...message, subject: `#${i}` });

    expect(outbox.sent).toHaveLength(200);
    expect(outbox.sent[0].subject).toBe('#50');
  });

  it('logs the recipient and subject, never the body', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');

    await new OutboxMailService().send({
      ...message,
      text: 'chi tiết riêng tư',
    });

    const logged = String(log.mock.calls[0][0]);
    expect(logged).toContain(message.to);
    expect(logged).not.toContain('chi tiết riêng tư');
  });
});

describe('ResendMailService', () => {
  const okFetch = () => jest.fn().mockResolvedValue({ ok: true, status: 200 });

  it('posts the message to Resend with the key, as JSON', async () => {
    const fetchFn = okFetch();

    await new ResendMailService('re_key', 'Hiflow <a@b.c>', fetchFn).send(
      message,
    );

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_key',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Hiflow <a@b.c>',
      to: [message.to],
      subject: message.subject,
      text: message.text,
    });
  });

  it('never throws when Resend refuses, and logs only the status', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 422 });

    await expect(
      new ResendMailService('k', 'f', fetchFn as unknown as typeof fetch).send(
        message,
      ),
    ).resolves.toBeUndefined();
    expect(String(warn.mock.calls[0][0])).toContain('422');
    expect(String(warn.mock.calls[0][0])).not.toContain(message.to);
  });

  it('never throws when Resend cannot be reached', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      new ResendMailService('k', 'f', fetchFn as unknown as typeof fetch).send(
        message,
      ),
    ).resolves.toBeUndefined();
  });
});

describe('createMail', () => {
  it('uses the outbox unless Resend is chosen', () => {
    expect(createMail(new ConfigService({}))).toBeInstanceOf(OutboxMailService);
    expect(
      createMail(new ConfigService({ MAIL_DRIVER: 'outbox' })),
    ).toBeInstanceOf(OutboxMailService);
  });

  it('uses Resend when chosen, and fails at boot if its settings are missing', () => {
    expect(
      createMail(
        new ConfigService({
          MAIL_DRIVER: 'resend',
          RESEND_API_KEY: 'k',
          MAIL_FROM: 'f',
        }),
      ),
    ).toBeInstanceOf(ResendMailService);
    expect(() =>
      createMail(new ConfigService({ MAIL_DRIVER: 'resend' })),
    ).toThrow('RESEND_API_KEY');
  });
});

describe('mail templates', () => {
  const data = {
    to: 'a@b.c',
    fullName: 'Nguyễn Văn A',
    jobTitle: 'Lập trình viên',
  };

  it('confirm a first submission by name and job, in Vietnamese', () => {
    const mail = applicationReceivedMail(data);

    expect(mail.to).toBe('a@b.c');
    expect(mail.subject).toContain('Lập trình viên');
    expect(mail.text).toContain('Xin chào Nguyễn Văn A');
    expect(mail.text).toContain('"Lập trình viên"');
  });

  it('tell a repeat submitter that nothing new was created', () => {
    const mail = alreadyAppliedMail(data);

    expect(mail.subject).toContain('đã ứng tuyển');
    expect(mail.text).toContain('không tạo thêm hồ sơ mới');
    expect(mail.text).toContain('bỏ qua thư');
  });

  it.each([applicationReceivedMail, alreadyAppliedMail])(
    "keep a stranger's text on one line so it cannot add paragraphs or links of its own",
    (template) => {
      const mail = template({
        ...data,
        fullName: 'Bạn\n\nBấm vào https://evil.example để nhận thưởng\r\n',
        jobTitle: 'Tin\nthứ hai',
      });

      expect(mail.subject).not.toMatch(/[\r\n]/);
      const greeting = mail.text.split('\n')[0];
      expect(greeting).toBe(
        'Xin chào Bạn Bấm vào https://evil.example để nhận thưởng,',
      );
      expect(mail.text.split('\n\n')[0]).toBe(greeting);
    },
  );
});
