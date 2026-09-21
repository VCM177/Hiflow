import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { buildSwaggerDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  SwaggerModule.setup('docs', app, buildSwaggerDocument(app));

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
