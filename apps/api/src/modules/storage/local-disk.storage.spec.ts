import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'hiflow-uploads-'));
    storage = new LocalDiskStorage({
      get: () => root,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes the file and returns a public url', async () => {
    const { url } = await storage.upload(pdf());

    expect(url).toMatch(/^\/uploads\/cv\/[0-9a-f-]{36}\.pdf$/);

    const onDisk = join(root, 'cv', url.split('/').pop() as string);
    expect((await readFile(onDisk)).toString()).toBe('%PDF-1.4 fake body');
  });

  it('never uses the client-supplied filename on disk', async () => {
    const { url } = await storage.upload(pdf('../../evil name.pdf'));

    expect(url).not.toContain('evil');
    expect(url).not.toContain('..');
  });

  it('gives two uploads of the same file different urls', async () => {
    const first = await storage.upload(pdf());
    const second = await storage.upload(pdf());

    expect(first.url).not.toBe(second.url);
  });

  it('removes a stored file', async () => {
    const { url } = await storage.upload(pdf());
    const onDisk = join(root, 'cv', url.split('/').pop() as string);

    await storage.remove(url);

    expect(existsSync(onDisk)).toBe(false);
  });

  it('does not throw when removing a file that is already gone', async () => {
    await expect(
      storage.remove('/uploads/cv/missing.pdf'),
    ).resolves.toBeUndefined();
  });

  it('cannot be tricked into deleting outside the CV directory', async () => {
    const outside = join(root, 'secret.txt');
    await writeFile(outside, 'keep me');

    await storage.remove('/uploads/cv/../secret.txt');

    expect(existsSync(outside)).toBe(true);
  });

  it('ignores urls that are not under the CV prefix', async () => {
    const outside = join(root, 'other.txt');
    await writeFile(outside, 'keep me');

    await storage.remove('/etc/passwd');
    await storage.remove(outside);

    expect(existsSync(outside)).toBe(true);
  });
});
