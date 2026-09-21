import { ConfigService } from '@nestjs/config';
import { extname, resolve } from 'node:path';

/** Folder (or bucket prefix) that holds CV files; every stored key starts with it. */
export const CV_SUBDIR = 'cv';

const CV_KEY = new RegExp(`^${CV_SUBDIR}/[A-Za-z0-9._-]+$`);

/** A key this app generates: the CV folder and one plain file name, nothing that climbs or nests. */
export const isCvKey = (key: string): boolean =>
  CV_KEY.test(key) && !key.includes('..');

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
