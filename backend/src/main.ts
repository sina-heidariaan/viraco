import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { configureApp } from './app.setup';
import { envWarnings, EnvironmentVariables, findEnvProblems } from './config/env.validation';

/**
 * Checks the environment before AppModule is loaded. ConfigModule validates too, but
 * it runs while app.module is imported, so its error comes with a Nest stack trace.
 */
function checkEnvironment(): void {
  // Same file and precedence as ConfigModule: variables already set win over .env.
  const envFile = resolve(process.cwd(), '.env');
  const hasEnvFile = existsSync(envFile);
  if (hasEnvFile) process.loadEnvFile(envFile);

  const problems = findEnvProblems(process.env);
  if (problems.length > 0) {
    console.error(
      [
        'The backend cannot start. Fix these environment variables:',
        ...problems.map((p) => `- ${p}`),
        hasEnvFile
          ? `Values come from the environment and from ${envFile}.`
          : `No .env file was found in ${process.cwd()}. Copy backend/.env.example to backend/.env and start the backend from backend/.`,
      ].join('\n'),
    );
    process.exit(1);
  }
  for (const warning of envWarnings(process.env)) Logger.warn(warning, 'Environment');
}

async function bootstrap(): Promise<void> {
  checkEnvironment();
  // Loaded only after the check, so a bad environment never reaches ConfigModule.
  const { AppModule } = await import('./app.module');

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
