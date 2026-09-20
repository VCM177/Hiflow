import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { assertValidCv } from './cv-file.validator';
import { resolveUploadRoot, UPLOAD_URL_PREFIX } from './storage.constants';
import {
  StorageService,
  StoredFile,
  UploadedFileData,
} from './storage.service';

const CV_SUBDIR = 'cv';

@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly cvDir: string;

  constructor(config: ConfigService) {
    super();
    this.cvDir = join(resolveUploadRoot(config), CV_SUBDIR);
  }

  async upload(file: UploadedFileData): Promise<StoredFile> {
    const ext = assertValidCv(file);
    // Server-generated name: the client's filename is never used on disk.
    const filename = `${randomUUID()}${ext}`;

    await mkdir(this.cvDir, { recursive: true });
    await writeFile(join(this.cvDir, filename), file.buffer);

    return { url: `${UPLOAD_URL_PREFIX}/${CV_SUBDIR}/${filename}` };
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(`${UPLOAD_URL_PREFIX}/${CV_SUBDIR}/`)) {
      return;
    }

    // basename() drops any `../` segments, so the target can only ever be a
    // direct child of the CV directory.
    await rm(join(this.cvDir, basename(url)), { force: true });
  }
}
