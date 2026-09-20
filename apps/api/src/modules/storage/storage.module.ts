import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import type { Response } from 'express';
import { LocalDiskStorage } from './local-disk.storage';
import { resolveUploadRoot, UPLOAD_URL_PREFIX } from './storage.constants';
import { StorageService } from './storage.service';

@Module({
  imports: [
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: resolveUploadRoot(config),
          serveRoot: UPLOAD_URL_PREFIX,
          serveStaticOptions: {
            index: false,
            dotfiles: 'deny',
            // Uploaded documents must download, never render or sniff.
            setHeaders: (res: Response) => {
              res.setHeader('Content-Disposition', 'attachment');
              res.setHeader('X-Content-Type-Options', 'nosniff');
            },
          },
        },
      ],
    }),
  ],
  providers: [{ provide: StorageService, useClass: LocalDiskStorage }],
  exports: [StorageService],
})
export class StorageModule {}
