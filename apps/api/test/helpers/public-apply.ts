import request from 'supertest';
import { App } from 'supertest/types';

export const PDF = Buffer.from('%PDF-1.4\n% cv sent through the public form\n');

/** One stored (uncompressed) zip entry per name: enough to look like a Word file. */
const zipOf = (...names: string[]): Buffer =>
  Buffer.concat(
    names.map((name) => {
      const body = Buffer.from('hi');
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt32LE(body.length, 18);
      header.writeUInt32LE(body.length, 22);
      header.writeUInt16LE(Buffer.byteLength(name), 26);
      return Buffer.concat([header, Buffer.from(name), body]);
    }),
  );

export const DOCX = zipOf(
  '[Content_Types].xml',
  '_rels/.rels',
  'word/document.xml',
);

export interface FormFields {
  fullName?: string;
  email?: string;
  phone?: string;
  consent?: string;
  turnstileToken?: string;
  [extra: string]: string | undefined;
}

export interface CvFile {
  content: Buffer;
  filename: string;
}

export const VALID_FIELDS: Required<
  Pick<FormFields, 'fullName' | 'phone' | 'consent'>
> = {
  fullName: 'Nguyễn Thị Ứng Tuyển',
  phone: '0901234567',
  consent: 'true',
};

/** Fills in the application form the way the web page's multipart request would. */
export function submitForm(
  server: App,
  jobId: string,
  fields: FormFields,
  cv: CvFile | null = { content: PDF, filename: 'cv.pdf' },
  headers: Record<string, string> = {},
) {
  const req = request(server)
    .post(`/public/jobs/${jobId}/applications`)
    .set(headers);

  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) req.field(name, value);
  }
  return cv ? req.attach('cv', cv.content, { filename: cv.filename }) : req;
}
