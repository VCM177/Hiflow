import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  SIGNED_URL_SECONDS,
  SupabaseBucket,
  SupabaseStorage,
} from './supabase.storage';
import { UploadedFileData } from './storage.service';

const pdf = (name = 'cv.pdf'): UploadedFileData => {
  const buffer = Buffer.from('%PDF-1.4 fake body');
  return {
    originalname: name,
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
  };
};

const fakeBucket = () => {
  const upload = jest.fn().mockResolvedValue({ error: null });
  const remove = jest.fn().mockResolvedValue({ error: null });
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://project.supabase.co/sign/x?token=t' },
    error: null,
  });
  const bucket = { upload, remove, createSignedUrl } as SupabaseBucket;
  return { bucket, upload, remove, createSignedUrl };
};

describe('SupabaseStorage', () => {
  describe('upload', () => {
    it('stores the file under a server-generated key, private and never overwriting', async () => {
      const { bucket, upload } = fakeBucket();

      const { key } = await new SupabaseStorage(bucket).upload(pdf());

      expect(key).toMatch(/^cv\/[0-9a-f-]{36}\.pdf$/);
      expect(upload).toHaveBeenCalledWith(key, expect.any(Buffer), {
        contentType: 'application/pdf',
        upsert: false,
      });
    });

    it('never uses the client-supplied filename as the key', async () => {
      const { bucket } = fakeBucket();

      const { key } = await new SupabaseStorage(bucket).upload(
        pdf('../../evil name.pdf'),
      );

      expect(key).not.toContain('evil');
      expect(key).not.toContain('..');
    });

    it('refuses a disguised file before anything leaves the server', async () => {
      const { bucket, upload } = fakeBucket();
      const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);

      await expect(
        new SupabaseStorage(bucket).upload({
          originalname: 'cv.pdf',
          mimetype: 'application/pdf',
          size: exe.length,
          buffer: exe,
        }),
      ).rejects.toThrow('không khớp');
      expect(upload).not.toHaveBeenCalled();
    });

    it('reports an outage as 503 without leaking the provider message', async () => {
      const { bucket, upload } = fakeBucket();
      upload.mockResolvedValue({ error: { message: 'secret project detail' } });

      const failure = new SupabaseStorage(bucket).upload(pdf());

      await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(failure).rejects.not.toThrow('secret project detail');
    });
  });

  describe('remove', () => {
    it('removes the object by key', async () => {
      const { bucket, remove } = fakeBucket();

      await new SupabaseStorage(bucket).remove('cv/abc.pdf');

      expect(remove).toHaveBeenCalledWith(['cv/abc.pdf']);
    });

    it('ignores a key that is not under the CV prefix', async () => {
      const { bucket, remove } = fakeBucket();

      await new SupabaseStorage(bucket).remove('other/abc.pdf');
      await new SupabaseStorage(bucket).remove('../cv/abc.pdf');
      await new SupabaseStorage(bucket).remove('cv/../other.pdf');
      await new SupabaseStorage(bucket).remove('cv/nested/abc.pdf');

      expect(remove).not.toHaveBeenCalled();
    });

    it('throws when the provider fails, so the caller can log a warning', async () => {
      const { bucket, remove } = fakeBucket();
      remove.mockResolvedValue({ error: { message: 'boom' } });

      await expect(
        new SupabaseStorage(bucket).remove('cv/abc.pdf'),
      ).rejects.toThrow('boom');
    });
  });

  describe('download', () => {
    it('hands back a signed address that lasts a minute and saves under the given name', async () => {
      const { bucket, createSignedUrl } = fakeBucket();

      const download = await new SupabaseStorage(bucket).download(
        'cv/abc.pdf',
        'CV-1.pdf',
      );

      expect(SIGNED_URL_SECONDS).toBe(60);
      expect(createSignedUrl).toHaveBeenCalledWith('cv/abc.pdf', 60, {
        download: 'CV-1.pdf',
      });
      expect(download).toEqual({
        kind: 'redirect',
        url: 'https://project.supabase.co/sign/x?token=t',
      });
    });

    it.each([
      ['status 404', { message: 'gone', status: 404 }],
      ['a "not found" message', { message: 'Object not found' }],
    ])('answers NotFound for %s', async (_label, error) => {
      const { bucket, createSignedUrl } = fakeBucket();
      createSignedUrl.mockResolvedValue({ data: null, error });

      await expect(
        new SupabaseStorage(bucket).download('cv/abc.pdf', 'x.pdf'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers 503 when signing fails for another reason', async () => {
      const { bucket, createSignedUrl } = fakeBucket();
      createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'upstream timeout', status: 500 },
      });

      await expect(
        new SupabaseStorage(bucket).download('cv/abc.pdf', 'x.pdf'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('never signs a key outside the CV prefix', async () => {
      const { bucket, createSignedUrl } = fakeBucket();

      for (const key of [
        'other/secret.pdf',
        'cv/../secret.pdf',
        'cv/a/b.pdf',
      ]) {
        await expect(
          new SupabaseStorage(bucket).download(key, 'x.pdf'),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });
});
