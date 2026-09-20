import { ConfigService } from '@nestjs/config';
import { extname, resolve } from 'node:path';

/** Folder (or bucket prefix) that holds CV files; every stored key starts with it. */
export const CV_SUBDIR = 'cv';

// `.doc` is not accepted any more, but CVs stored before that still download.
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
};

export const contentTypeOfKey = (key: string): string =>
  CONTENT_TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream';

export function resolveUploadRoot(config: ConfigService): string {
  return resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
}
