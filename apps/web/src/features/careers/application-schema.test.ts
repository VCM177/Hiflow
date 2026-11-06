import { describe, expect, it } from 'vitest';

import { applicationSchema, buildApplicationBody } from './application-schema';

const cv = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
const valid = {
  fullName: ' Nguyễn Văn A ',
  email: ' A@Example.com ',
  phone: '090 123-4567',
  cv,
  consent: true,
};

describe('applicationSchema', () => {
  it('normalises a valid form', () => {
    const result = applicationSchema.parse(valid);
    expect(result).toMatchObject({
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
      phone: '0901234567',
    });
  });

  it('requires the consent', () => {
    const result = applicationSchema.safeParse({ ...valid, consent: false });
    expect(result.error?.issues[0].path).toEqual(['consent']);
  });

  it('requires a CV', () => {
    const result = applicationSchema.safeParse({ ...valid, cv: null });
    expect(result.error?.issues[0].message).toContain('chọn tệp CV');
  });

  it('refuses a legacy .doc file', () => {
    const result = applicationSchema.safeParse({
      ...valid,
      cv: new File(['x'], 'cv.doc'),
    });
    expect(result.error?.issues[0].message).toContain('PDF hoặc DOCX');
  });

  it('refuses a file over 5 MB', () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'cv.pdf');
    const result = applicationSchema.safeParse({ ...valid, cv: big });
    expect(result.error?.issues[0].message).toContain('5 MB');
  });
});

describe('buildApplicationBody', () => {
  it('sends the fields, the CV and the token as multipart text', () => {
    const body = buildApplicationBody(applicationSchema.parse(valid), 'tok');
    expect(body.get('consent')).toBe('true');
    expect(body.get('turnstileToken')).toBe('tok');
    expect(body.get('cv')).toBeInstanceOf(File);
    expect(body.get('email')).toBe('a@example.com');
  });

  it('leaves the token out when there is none', () => {
    const body = buildApplicationBody(applicationSchema.parse(valid), null);
    expect(body.has('turnstileToken')).toBe(false);
  });
});
