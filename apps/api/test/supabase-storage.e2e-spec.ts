import { ConfigService } from '@nestjs/config';
// Importing the module registers ConfigModule, which loads apps/api/.env.
import './../src/app.module';
import { SupabaseStorage } from './../src/modules/storage/supabase.storage';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET } =
  process.env;

// Real Supabase only: skipped (and reported as skipped) without credentials.
const describeWithSupabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? describe : describe.skip;

const PDF = Buffer.from('%PDF-1.4\n% e2e upload to a private bucket\n');

describeWithSupabase('Supabase private bucket (integration)', () => {
  // Built in beforeAll: the body of a skipped describe still runs, and without
  // credentials this would throw while the suite is only being collected.
  let storage: SupabaseStorage;
  const uploaded: string[] = [];

  beforeAll(() => {
    storage = SupabaseStorage.fromConfig(
      new ConfigService({
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_BUCKET,
      }),
    );
  });

  afterAll(async () => {
    for (const key of uploaded) await storage.remove(key).catch(() => {});
  });

  const upload = async () => {
    const { key } = await storage.upload({
      originalname: 'e2e-cv.pdf',
      mimetype: 'application/pdf',
      size: PDF.length,
      buffer: PDF,
    });
    uploaded.push(key);
    return key;
  };

  it('stores a CV and hands out a signed address that downloads it as an attachment', async () => {
    const key = await upload();

    const download = await storage.download(key, 'CV-e2e.pdf');
    if (download.kind !== 'redirect') throw new Error('expected a redirect');
    const response = await fetch(download.url);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('CV-e2e.pdf');
    expect(Buffer.from(await response.arrayBuffer()).equals(PDF)).toBe(true);
  });

  it('keeps the bucket private: the public address of the same object does not serve it', async () => {
    const key = await upload();
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET ?? 'hiflow-cvs'}/${key}`;

    const response = await fetch(publicUrl);

    expect(response.status).not.toBe(200);
  });

  it('answers NotFound for a key that was never stored, and after removal', async () => {
    const key = await upload();
    await storage.remove(key);
    uploaded.splice(uploaded.indexOf(key), 1);

    await expect(storage.download(key, 'x.pdf')).rejects.toMatchObject({
      status: 404,
    });
  });
});
