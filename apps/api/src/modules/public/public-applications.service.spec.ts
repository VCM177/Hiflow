import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AttemptLimiter } from '../../common/throttle/attempt-limiter';
import { ApplicationWorkflowService } from '../applications/application-workflow.service';
import { Job } from '../jobs/entities/job.entity';
import type { MailMessage } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { SystemUserService } from '../users/system-user.service';
import {
  APPLICATION_RECEIPT,
  PublicApplicationsService,
} from './public-applications.service';
import { SubmitApplicationDto } from './submit-application.dto';
import { TurnstileService } from './turnstile.service';

const DTO: SubmitApplicationDto = {
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  phone: '0901234567',
  consent: true,
  turnstileToken: 'token',
};
const CV = {
  originalname: 'cv.pdf',
  mimetype: 'application/pdf',
  size: 10,
  buffer: Buffer.from('%PDF-1.4 x'),
};
const JOB = { id: 'job-1', title: 'Lập trình viên' };

/** The services around it are replaced so the order of the steps can be read off `calls`. */
function build(options: { job?: unknown; createNew?: string | null } = {}) {
  const calls: string[] = [];
  const track = <T>(name: string, value: T) =>
    jest.fn().mockImplementation(() => {
      calls.push(name);
      return Promise.resolve(value);
    });

  const turnstile = { verify: track('turnstile', undefined) };
  const limiter = { hit: track('limiter', undefined) };
  const jobs = {
    findOneBy: track('job', 'job' in options ? options.job : JOB),
  };
  const storage = {
    upload: track('upload', { key: 'cv/new.pdf' }),
    remove: track('remove', undefined),
  };
  const mail = { send: track('mail', undefined) };
  const createNew = track(
    'createNew',
    'createNew' in options ? options.createNew : 'app-1',
  );
  const manager = {
    createQueryBuilder: () => ({
      insert: () => ({
        into: () => ({
          values: () => ({
            orIgnore: () => ({ execute: () => Promise.resolve() }),
          }),
        }),
      }),
    }),
    findOneByOrFail: () => Promise.resolve({ id: 'cand-1' }),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: unknown) => unknown) => {
      calls.push('transaction');
      return Promise.resolve(work(manager));
    }),
  };
  /** The messages handed to the mail service, typed. */
  const sentMail = () => mail.send.mock.calls as [MailMessage][];

  const service = new PublicApplicationsService(
    jobs as unknown as Repository<Job>,
    dataSource as unknown as DataSource,
    { createNew } as unknown as ApplicationWorkflowService,
    { id: () => Promise.resolve('system-1') } as unknown as SystemUserService,
    storage as unknown as StorageService,
    mail,
    turnstile as unknown as TurnstileService,
    limiter as unknown as AttemptLimiter,
  );

  return {
    service,
    calls,
    turnstile,
    limiter,
    storage,
    mail,
    createNew,
    dataSource,
    sentMail,
  };
}

describe('PublicApplicationsService.submit', () => {
  it('runs the cheap and protective checks before anything is stored', async () => {
    const { service, calls } = build();

    await service.submit('job-1', DTO, CV, '203.0.113.1');

    expect(calls).toEqual([
      'turnstile',
      'limiter',
      'job',
      'upload',
      'transaction',
      'createNew',
      'mail',
    ]);
  });

  it('checks the captcha against the caller address and limits by the email typed', async () => {
    const { service, turnstile, limiter } = build();

    await service.submit('job-1', DTO, CV, '203.0.113.1');

    expect(turnstile.verify).toHaveBeenCalledWith('token', '203.0.113.1');
    expect(limiter.hit).toHaveBeenCalledWith(
      'public-apply-email',
      'a@example.com',
    );
  });

  it('answers 400 for a missing CV without spending a captcha check or a rate-limit hit', async () => {
    const { service, calls } = build();

    await expect(
      service.submit('job-1', DTO, undefined, 'ip'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toEqual([]);
  });

  it('stops at a failed captcha: no limit hit, no lookup, no file, no mail', async () => {
    const { service, calls, turnstile } = build();
    turnstile.verify.mockRejectedValue(new BadRequestException('captcha'));

    await expect(service.submit('job-1', DTO, CV, 'ip')).rejects.toThrow(
      'captcha',
    );
    expect(calls).not.toContain('upload');
    expect(calls).not.toContain('mail');
  });

  it('stops at an exhausted email limit before touching the database or storage', async () => {
    const { service, calls, limiter } = build();
    limiter.hit.mockRejectedValue(new Error('429'));

    await expect(service.submit('job-1', DTO, CV, 'ip')).rejects.toThrow('429');
    expect(calls).toEqual(['turnstile']);
  });

  it('answers 404 when the job is not open, storing nothing and sending nothing', async () => {
    const { service, calls } = build({ job: null });

    await expect(service.submit('job-1', DTO, CV, 'ip')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(calls).not.toContain('upload');
    expect(calls).not.toContain('mail');
  });

  describe('a first submission', () => {
    it('keeps the CV and sends the "received" mail', async () => {
      const { service, storage, sentMail } = build({ createNew: 'app-1' });

      await service.submit('job-1', DTO, CV, 'ip');

      expect(storage.remove).not.toHaveBeenCalled();
      const [[sent]] = sentMail();
      expect(sent.to).toBe('a@example.com');
      expect(sent.subject).toContain('đã nhận hồ sơ');
    });

    it('credits the system user, not a person, and records consent', async () => {
      const { service, createNew } = build();

      await service.submit('job-1', DTO, CV, 'ip');

      const [, created] = createNew.mock.calls[0] as [unknown, unknown];
      expect(created).toMatchObject({
        candidateId: 'cand-1',
        jobId: 'job-1',
        cvFileKey: 'cv/new.pdf',
        createdById: 'system-1',
        consentAt: expect.any(Date) as Date,
      });
    });
  });

  describe('a repeat submission', () => {
    it('throws the new CV away and sends the "already applied" mail instead', async () => {
      const { service, storage, sentMail } = build({ createNew: null });

      await service.submit('job-1', DTO, CV, 'ip');

      expect(storage.remove).toHaveBeenCalledWith('cv/new.pdf');
      expect(sentMail()[0][0].subject).toContain('đã ứng tuyển');
    });
  });

  it('gives exactly the same answer whatever happened', async () => {
    const first = await build({ createNew: 'app-1' }).service.submit(
      'job-1',
      DTO,
      CV,
      'ip',
    );
    const repeat = await build({ createNew: null }).service.submit(
      'job-1',
      DTO,
      CV,
      'ip',
    );

    expect(first).toEqual(repeat);
    expect(first).toBe(APPLICATION_RECEIPT);
  });

  it('removes the stored CV and rethrows when the database write fails', async () => {
    const { service, storage, mail, dataSource } = build();
    dataSource.transaction.mockRejectedValue(new Error('db down'));

    await expect(service.submit('job-1', DTO, CV, 'ip')).rejects.toThrow(
      'db down',
    );
    expect(storage.remove).toHaveBeenCalledWith('cv/new.pdf');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not fail, or wait for, the mail', async () => {
    const { service, mail } = build();
    mail.send.mockReturnValue(new Promise(() => undefined));

    await expect(service.submit('job-1', DTO, CV, 'ip')).resolves.toBe(
      APPLICATION_RECEIPT,
    );
  });

  it('does not let a failed cleanup fail the request', async () => {
    const { service, storage } = build({ createNew: null });
    storage.remove.mockRejectedValue(new Error('storage down'));

    await expect(service.submit('job-1', DTO, CV, 'ip')).resolves.toBe(
      APPLICATION_RECEIPT,
    );
  });
});
