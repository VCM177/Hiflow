import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { assertValidCv } from './cv-file.validator';
import {
  contentTypeOfKey,
  CV_SUBDIR,
  resolveUploadRoot,
} from './storage.constants';
import {
  FileDownload,
  StorageService,
  StoredFile,
  UploadedFileData,
} from './storage.service';

@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly cvDir: string;

  constructor(config: ConfigService) {
    super();
    this.cvDir = join(resolveUploadRoot(config), CV_SUBDIR);
  }

  async upload(file: UploadedFileData): Promise<StoredFile> {
    const ext = await assertValidCv(file);
    // Server-generated name: the client's filename is never used on disk.
    const filename = `${randomUUID()}${ext}`;

    await mkdir(this.cvDir, { recursive: true });
    await writeFile(join(this.cvDir, filename), file.buffer);

    return { key: `${CV_SUBDIR}/${filename}` };
  }

  async remove(key: string): Promise<void> {
    const path = this.pathOf(key);
    if (path) await rm(path, { force: true });
  }

  async download(key: string, filename: string): Promise<FileDownload> {
    const path = this.pathOf(key);

    if (!path || !(await this.isFile(path))) {
      throw new NotFoundException('Không tìm thấy tệp CV');
    }

    return {
      kind: 'stream',
      stream: createReadStream(path),
      contentType: contentTypeOfKey(key),
      filename,
    };
  }

  /**
   * basename() drops any `../` segments, so the target can only ever be a
   * direct child of the CV directory; other prefixes are not ours at all.
   */
  private pathOf(key: string): string | null {
    if (!key.startsWith(`${CV_SUBDIR}/`)) return null;

    return join(this.cvDir, basename(key));
  }

  private async isFile(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isFile();
    } catch {
      return false;
    }
  }
}
