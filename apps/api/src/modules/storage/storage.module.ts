import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDiskStorage } from './local-disk.storage';
import { StorageService } from './storage.service';
import { SupabaseStorage } from './supabase.storage';

/**
 * STORAGE_DRIVER=supabase stores CVs in a private Supabase bucket. The default,
 * local disk, is for development and tests only: a container's disk does not
 * survive a restart, which is why production refuses to boot without Supabase.
 */
export function createStorage(config: ConfigService): StorageService {
  return config.get<string>('STORAGE_DRIVER') === 'supabase'
    ? SupabaseStorage.fromConfig(config)
    : new LocalDiskStorage(config);
}

@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: createStorage,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
