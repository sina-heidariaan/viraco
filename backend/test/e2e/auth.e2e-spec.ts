import { createHash } from 'node:crypto';
import { IsNull } from 'typeorm';
import { RefreshToken } from '../../src/modules/auth/refresh-token.entity';
import { Role } from '../../src/modules/users/role.enum';
import { User } from '../../src/modules/users/user.entity';
import { access, createTestApp, createUser, nextIp, PASSWORD, readCookies, refresh, TestContext } from './support/app';

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

describe('Auth: cookies, refresh rotation, logout, rate limit (plan §5.2)', () => {
  let ctx: TestContext;
  let user: User;

  beforeAll(async () => {
    ctx = await createTestApp();
    user = await createUser(ctx.dataSource, 'member@test.local', Role.Member);
  });

  afterAll(() => ctx.app.close());

  const tokens = () => ctx.dataSource.getRepository(RefreshToken);
  const doLogin = (password = PASSWORD, ip = nextIp()) =>
    ctx.http().post('/auth/login').set('X-Forwarded-For', ip).send({ email: 'MEMBER@test.local', password });

  it('login sets HttpOnly cookies with the planned attributes and stores only the token hash', async () => {
    const res = await doLogin().expect(200);
    expect(res.body).toEqual({ id: user.id, email: user.email, name: user.name, role: Role.Member });

    const setCookie = res.get('Set-Cookie') ?? [];
    const accessHeader = setCookie.find((c) => c.startsWith('access_token='));
    const refreshHeader = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(accessHeader).toMatch(/HttpOnly/);
    expect(accessHeader).toMatch(/SameSite=Lax/);
    expect(accessHeader).toMatch(/Path=\/;/);
    expect(refreshHeader).toMatch(/HttpOnly/);
    expect(refreshHeader).toMatch(/SameSite=Strict/);
    expect(refreshHeader).toMatch(/Path=\/api\/v1\/auth/);

    const raw = readCookies(setCookie).refresh_token;
    expect(await tokens().countBy({ tokenHash: raw })).toBe(0);
    expect(await tokens().countBy({ tokenHash: sha256(raw) })).toBe(1);
  });

  it('GET /auth/me without a cookie → 401 in the standard error shape', async () => {
    const res = await ctx.http().get('/auth/me').expect(401);
    expect(res.body).toEqual({ statusCode: 401, error: 'Unauthorized', message: 'Unauthorized', details: [] });
  });

  it('wrong password and unknown email give the same 401 body', async () => {
    const wrong = await doLogin('wrong-password').expect(401);
    const unknown = await ctx.http().post('/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'ghost@test.local', password: PASSWORD }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('invalid body → 400 with field details; unknown fields rejected', async () => {
    const res = await ctx.http().post('/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'nope', extra: 1 }).expect(400);
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'extra']));
  });

  it('refresh rotates the token; reusing the old one revokes every session of the user', async () => {
    const first = readCookies((await doLogin().expect(200)).get('Set-Cookie') ?? []);
    const rotated = await ctx.http().post('/auth/refresh').set('Cookie', refresh(first)).expect(200);
    const second = readCookies(rotated.get('Set-Cookie') ?? []);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    await ctx.http().get('/auth/me').set('Cookie', access(second)).expect(200);

    await ctx.http().post('/auth/refresh').set('Cookie', refresh(first)).expect(401); // replay
    expect(await tokens().countBy({ userId: user.id, revokedAt: IsNull() })).toBe(0);
    await ctx.http().post('/auth/refresh').set('Cookie', refresh(second)).expect(401);
  });

  it('logout revokes the refresh token and clears both cookies', async () => {
    const jar = readCookies((await doLogin().expect(200)).get('Set-Cookie') ?? []);
    const res = await ctx.http().post('/auth/logout').set('Cookie', refresh(jar)).expect(204);
    const cleared = (res.get('Set-Cookie') ?? []).filter((c) => /Expires=Thu, 01 Jan 1970/.test(c));
    expect(cleared).toHaveLength(2);
    await ctx.http().post('/auth/refresh').set('Cookie', refresh(jar)).expect(401);
  });

  it('a tampered access token → 401', async () => {
    const jar = readCookies((await doLogin().expect(200)).get('Set-Cookie') ?? []);
    const [h, p] = jar.access_token.split('.');
    await ctx.http().get('/auth/me').set('Cookie', `access_token=${h}.${p}.AAAA`).expect(401);
  });

  it('login is limited to 5 attempts per minute per client IP', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) await doLogin('wrong-password', ip).expect(401);
    const blocked = await doLogin(PASSWORD, ip).expect(429);
    expect(blocked.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
    await doLogin(PASSWORD, nextIp()).expect(200); // another client is not affected
  });
});
