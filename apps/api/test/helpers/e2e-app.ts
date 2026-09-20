import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../../src/app.module';
import { configureApp } from './../../src/app.setup';
import { seedBase, seedPassword } from './../../src/database/seeds/base.seeder';

export interface E2eContext {
  app: INestApplication;
  dataSource: DataSource;
  server: App;
}

/**
 * Boots the whole application against the configured database.
 *
 * Uses NestFactory, exactly as main.ts does, rather than Test.createTestingModule:
 * ServeStaticModule (uploaded CVs) only registers when the HTTP adapter already
 * exists, which is not the case in a testing module.
 */
export async function createE2eApp(): Promise<E2eContext> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  await seedBase(dataSource, seedPassword());

  return { app, dataSource, server: app.getHttpServer() as App };
}

/** Logs a seeded demo account in and returns its bearer token. */
export async function loginAs(server: App, email: string): Promise<string> {
  const response = await request(server)
    .post('/auth/login')
    .send({ email, password: seedPassword() })
    .expect(200);

  return (response.body as { accessToken: string }).accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
