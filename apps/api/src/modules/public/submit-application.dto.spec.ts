import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitApplicationDto } from './submit-application.dto';

const VALID = {
  fullName: 'Nguyễn Văn A',
  email: 'nguyen.van.a@example.com',
  phone: '0901234567',
  consent: 'true',
};

/** What the form's fields become after the global pipe (whitelist + transform). */
const check = async (fields: Record<string, unknown>) => {
  const dto = plainToInstance(SubmitApplicationDto, fields);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((error) => error.property).sort() };
};

describe('SubmitApplicationDto', () => {
  it('accepts a complete form and normalises the text a person types', async () => {
    const { dto, fields } = await check({
      ...VALID,
      fullName: '  Nguyễn Văn A  ',
      email: '  Nguyen.Van.A@Example.COM ',
      phone: '090 123-4567',
    });

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      fullName: 'Nguyễn Văn A',
      email: 'nguyen.van.a@example.com',
      phone: '0901234567',
      consent: true,
    });
  });

  it('takes the captcha token when there is one', async () => {
    expect((await check({ ...VALID, turnstileToken: 'abc' })).fields).toEqual(
      [],
    );
  });

  describe('the consent line', () => {
    it.each(['false', '', 'yes', '1', 'TRUE', undefined])(
      'is refused unless it is exactly "true" (%j)',
      async (consent) => {
        expect((await check({ ...VALID, consent })).fields).toEqual([
          'consent',
        ]);
      },
    );
  });

  describe('the name', () => {
    it.each([
      ['a line break', 'Nguyễn\nVăn A'],
      ['a carriage return', 'Nguyễn\rVăn A'],
      ['a tab', 'Nguyễn\tVăn A'],
      ['a right-to-left override', 'Nguyễn ‮gpj.exe'],
      ['a zero-width space', 'Nguyễn​Văn'],
      ['nothing but spaces', '     '],
      ['a single letter', 'A'],
      ['more than 100 characters', 'A'.repeat(101)],
      ['a non-string', { $ne: '' }],
    ])('is refused with %s', async (_label, fullName) => {
      expect((await check({ ...VALID, fullName })).fields).toEqual([
        'fullName',
      ]);
    });

    it('keeps accents and apostrophes', async () => {
      expect(
        (await check({ ...VALID, fullName: "Đặng Thị Ngọc O'Brien" })).fields,
      ).toEqual([]);
    });
  });

  describe('the email', () => {
    it.each([
      '',
      'not-an-email',
      'a@b',
      'a b@example.com',
      `${'a'.repeat(150)}@example.com`,
      { $ne: '' },
    ])('is refused (%j)', async (email) => {
      expect((await check({ ...VALID, email })).fields).toEqual(['email']);
    });
  });

  describe('the phone number', () => {
    it.each(['+84901234567', '0901234567', '090-123-4567', '(090) 123 4567'])(
      'accepts %s',
      async (phone) => {
        expect((await check({ ...VALID, phone })).fields).toEqual([]);
      },
    );

    it.each(['', '12345', 'abcdefghij', '09012345678901', undefined])(
      'refuses %j',
      async (phone) => {
        expect((await check({ ...VALID, phone })).fields).toEqual(['phone']);
      },
    );
  });

  it('refuses any field the form does not have, so nothing extra is ever stored', async () => {
    for (const extra of [
      { source: 'REFERRAL' },
      { status: 'HIRED' },
      { assigneeId: 'x' },
      { cvFileKey: 'cv/other.pdf' },
      { isSystem: true },
    ]) {
      const { fields } = await check({ ...VALID, ...extra });
      expect(fields).toEqual([Object.keys(extra)[0]]);
    }
  });

  it('refuses an over-long captcha token', async () => {
    expect(
      (await check({ ...VALID, turnstileToken: 'x'.repeat(2049) })).fields,
    ).toEqual(['turnstileToken']);
  });
});
