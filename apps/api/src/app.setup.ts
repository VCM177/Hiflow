import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { parseAllowedOrigins } from './common/security/cors';
import { proxySecretMiddleware } from './common/security/proxy-secret';
import { parseTrustProxy } from './common/throttle/trust-proxy';

const LOCAL_WEB_ORIGIN = 'http://localhost:3000';

/** Runtime configuration shared by `main.ts` and the e2e test harness. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Must be set before any middleware reads `req.ip`, which the rate limiter keys on.
  (
    app.getHttpAdapter().getInstance() as {
      set(name: string, value: unknown): void;
    }
  ).set('trust proxy', parseTrustProxy(config.get<string>('TRUST_PROXY')));

  const proxySecret = config.get<string>('PROXY_SECRET');
  if (proxySecret) {
    app.use(proxySecretMiddleware(proxySecret));
  }

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // In production the browser talks to the web app's own domain, which proxies
  // to the API, so no cross-origin access is needed unless origins are listed.
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const origins = parseAllowedOrigins(
    config.get<string>('WEB_ORIGIN') ??
      (isProduction ? undefined : LOCAL_WEB_ORIGIN),
  );
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }
}
