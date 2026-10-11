import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // CORS stays disabled: the browser only talks to Next.js, which proxies to this API.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const host = config.get('HOST', { infer: true });
  const port = config.get('PORT', { infer: true });
  await app.listen(port, host);
  Logger.log(`API listening on http://${host}:${port}`, 'Bootstrap');
}

void bootstrap();
