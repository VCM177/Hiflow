import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { LocalDiskStorage } from './local-disk.storage';
import { UploadedFileData } from './storage.service';

const pdf = (name = 'Nguyen Van A.pdf'): UploadedFileData => {
  const buffer = Buffer.from('%PDF-1.4 fake body');
  return {
    originalname: name,
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
  };
};

const readAll = async (stream: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString();
};

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  const pathOf = (key: string) => join(root, key);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'hiflow-uploads-'));
    storage = new LocalDiskStorage({
      get: () => root,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('upload', () => {
    it('writes the file and returns a private key, not a url', async () => {
      const { key } = await storage.upload(pdf());

      expect(key).toMatch(/^cv\/[0-9a-f-]{36}\.pdf$/);
      expect((await readFile(pathOf(key))).toString()).toBe(
        '%PDF-1.4 fake body',
      );
    });

    it('never uses the client-supplied filename on disk', async () => {
      const { key } = await storage.upload(pdf('../../evil name.pdf'));

      expect(key).not.toContain('evil');
      expect(key).not.toContain('..');
    });

    it('gives two uploads of the same file different keys', async () => {
      const first = await storage.upload(pdf());
      const second = await storage.upload(pdf());

      expect(first.key).not.toBe(second.key);
    });

    it('refuses a file that is not what its name says, and writes nothing', async () => {
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);

      await expect(
        storage.upload({
          originalname: 'cv.pdf',
          mimetype: 'application/pdf',
          size: exe.length,
          buffer: exe,
        }),
      ).rejects.toThrow('không khớp');
      expect(existsSync(join(root, 'cv'))).toBe(false);
    });
  });

  describe('remove', () => {
    it('removes a stored file', async () => {
      const { key } = await storage.upload(pdf());

      await storage.remove(key);

      expect(existsSync(pathOf(key))).toBe(false);
    });

    it('does not throw when the file is already gone', async () => {
      await expect(storage.remove('cv/missing.pdf')).resolves.toBeUndefined();
    });

    it('cannot be tricked into deleting outside the CV directory', async () => {
      const outside = join(root, 'secret.txt');
      await writeFile(outside, 'keep me');

      await storage.remove('cv/../secret.txt');

      expect(existsSync(outside)).toBe(true);
    });

    it('ignores keys that are not under the CV prefix', async () => {
      const outside = join(root, 'other.txt');
      await writeFile(outside, 'keep me');

      await storage.remove('/etc/passwd');
      await storage.remove('other.txt');
      await storage.remove(outside);

      expect(existsSync(outside)).toBe(true);
    });
  });

  describe('download', () => {
    it('streams the stored bytes with a content type and the given filename', async () => {
      const { key } = await storage.upload(pdf());

      const download = await storage.download(key, 'CV-123.pdf');

      expect(download).toMatchObject({
        kind: 'stream',
        contentType: 'application/pdf',
        filename: 'CV-123.pdf',
      });
      if (download.kind !== 'stream') throw new Error('expected a stream');
      expect(await readAll(download.stream)).toBe('%PDF-1.4 fake body');
    });

    it('throws NotFound for a file that is gone', async () => {
      await expect(
        storage.download('cv/missing.pdf', 'x.pdf'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      'cv/../secret.txt',
      'secret.txt',
      '/etc/passwd',
      'other/x.pdf',
      '',
    ])('never reads outside the CV directory (%j)', async (key) => {
      await writeFile(join(root, 'secret.txt'), 'keep me');

      await expect(storage.download(key, 'x.pdf')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not treat a directory as a file', async () => {
      await storage.upload(pdf());

      await expect(storage.download('cv/', 'x.pdf')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
