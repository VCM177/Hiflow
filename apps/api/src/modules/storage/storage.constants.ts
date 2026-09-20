import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';

/** Public URL prefix under which stored files are served. */
export const UPLOAD_URL_PREFIX = '/uploads';

export function resolveUploadRoot(config: ConfigService): string {
  return resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
}
