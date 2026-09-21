import { ConfigService } from '@nestjs/config';
import { LocalDiskStorage } from './local-disk.storage';
import { isCvKey } from './storage.constants';
import { createStorage } from './storage.module';
import { SupabaseStorage } from './supabase.storage';

const configOf = (values: Record<string, string>) => new ConfigService(values);

describe('createStorage', () => {
  it('uses local disk by default, for development and tests', () => {
    expect(createStorage(configOf({}))).toBeInstanceOf(LocalDiskStorage);
    expect(createStorage(configOf({ STORAGE_DRIVER: 'local' }))).toBeInstanceOf(
      LocalDiskStorage,
    );
  });

  it('uses Supabase when asked to, without contacting it while booting', () => {
    const storage = createStorage(
      configOf({
        STORAGE_DRIVER: 'supabase',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      }),
    );

    expect(storage).toBeInstanceOf(SupabaseStorage);
  });

  it('fails at boot, not on the first upload, when the Supabase settings are missing', () => {
    expect(() =>
      createStorage(configOf({ STORAGE_DRIVER: 'supabase' })),
    ).toThrow('SUPABASE_URL');
  });
});

describe('isCvKey', () => {
  it.each(['cv/0b3f2c6e-7d1a-4c2b-9e8f-1a2b3c4d5e6f.pdf', 'cv/a.docx'])(
    'accepts a key this app generates (%s)',
    (key) => {
      expect(isCvKey(key)).toBe(true);
    },
  );

  it.each([
    '',
    'cv/',
    'cv/..',
    'cv/../x.pdf',
    'cv/a/b.pdf',
    '/cv/a.pdf',
    'other/a.pdf',
    'cv/a b.pdf',
    'cv/a\\b.pdf',
  ])('refuses %j', (key) => {
    expect(isCvKey(key)).toBe(false);
  });
});
