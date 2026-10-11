import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter, validationExceptionFactory } from './common/filters/all-exceptions.filter';
import { JsonDepthPipe } from './common/pipes/json-depth.pipe';

/** HTTP pipeline shared by main.ts and the e2e tests, so tests exercise the real setup. */
export function configureApp(app: NestExpressApplication): void {
  // Only the Next.js proxy on this machine reaches the API. Trusting loopback makes
  // req.ip the client IP from X-Forwarded-For, which the login rate limit keys on.
  app.set('trust proxy', 'loopback');

  // Above the 100 KB description limit, so that rule answers with a field error, not a 413.
  app.useBodyParser('json', { limit: '256kb' });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    // Order matters: the depth check must run before class-transformer touches the body.
    new JsonDepthPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
