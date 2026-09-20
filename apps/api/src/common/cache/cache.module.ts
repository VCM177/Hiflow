import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_STORE, CacheService, MemoryCacheStore } from './cache.service';

@Global()
@Module({
  providers: [
    { provide: CACHE_STORE, useFactory: () => new MemoryCacheStore() },
    {
      provide: CacheService,
      inject: [ConfigService, CACHE_STORE],
      useFactory: (config: ConfigService, store: MemoryCacheStore) =>
        new CacheService(config, store),
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
