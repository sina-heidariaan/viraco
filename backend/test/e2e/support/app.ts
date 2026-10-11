import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { Role } from '../../../src/modules/users/role.enum';
import { User } from '../../../src/modules/users/user.entity';

export const PASSWORD = 'Test@12345';

export interface TestContext {
  app: NestExpressApplication;
  dataSource: DataSource;
  http: () => ReturnType<typeof request>;
}

/** Boots the real AppModule with the production HTTP pipeline, on an empty test database. */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app);
  // Listen once on a free loopback port. Otherwise supertest opens and closes the
  // server per request, and overlapping requests can find it already closed.
  await app.listen(0, '127.0.0.1');
  const dataSource = app.get(DataSource);
  await dataSource.query('TRUNCATE todos, refresh_tokens, users CASCADE');
  return { app, dataSource, http: () => request(app.getHttpServer()) };
}

export async function createUser(
  ds: DataSource,
  email: string,
  role: Role,
  isActive = true,
): Promise<User> {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const { identifiers } = await ds.getRepository(User).insert({ email, name: email.split('@')[0], role, isActive, passwordHash });
  return ds.getRepository(User).findOneByOrFail({ id: (identifiers[0] as { id: string }).id });
}

let ipCounter = 0;
/** A fresh client IP per login, so the 5/min login limit never interferes with unrelated tests. */
export const nextIp = (): string => `198.51.100.${++ipCounter}`;

/** Logs in and returns the `name=value` pairs of the cookies that were set. */
export async function login(ctx: TestContext, email: string): Promise<Record<string, string>> {
  const res = await ctx.http().post('/auth/login').set('X-Forwarded-For', nextIp()).send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status}`);
  return readCookies(res.get('Set-Cookie') ?? []);
}

export function readCookies(setCookie: string[]): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const header of setCookie) {
    const [pair] = header.split(';');
    const i = pair.indexOf('=');
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return jar;
}

/** Cookie header carrying only the access token (what the browser sends to /api/v1/*). */
export const access = (jar: Record<string, string>): string => `access_token=${jar.access_token}`;
export const refresh = (jar: Record<string, string>): string => `refresh_token=${jar.refresh_token}`;
