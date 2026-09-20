import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseTrustProxy } from './common/throttle/trust-proxy';

/** Runtime configuration shared by `main.ts` and the e2e test harness. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Must be set before any middleware reads `req.ip`, which the rate limiter keys on.
  (
    app.getHttpAdapter().getInstance() as {
      set(name: string, value: unknown): void;
    }
  ).set('trust proxy', parseTrustProxy(config.get<string>('TRUST_PROXY')));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
}
