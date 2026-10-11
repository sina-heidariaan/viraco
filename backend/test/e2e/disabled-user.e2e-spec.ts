import { Role } from '../../src/modules/users/role.enum';
import { User } from '../../src/modules/users/user.entity';
import { access, createTestApp, createUser, login, nextIp, PASSWORD, refresh, TestContext } from './support/app';

// Plan §9 required test 3: a disabled user's old access token → 401 on any API.
describe('Disabled user cannot use an old token', () => {
  let ctx: TestContext;
  let ownerJar: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await createUser(ctx.dataSource, 'owner@test.local', Role.Owner);
    ownerJar = await login(ctx, 'owner@test.local');
  });

  afterAll(() => ctx.app.close());

  const setActive = (id: string, isActive: boolean) =>
    ctx.http().patch(`/users/${id}`).set('Cookie', access(ownerJar)).send({ isActive }).expect(200);

  describe('disabled by the owner through PATCH /users/:id', () => {
    let user: User;
    let jar: Record<string, string>;
    let taskId: string;

    beforeAll(async () => {
      user = await createUser(ctx.dataSource, 'member@test.local', Role.Member);
      jar = await login(ctx, user.email);
      const task = await ctx.http().post('/todos').set('Cookie', access(jar)).send({ title: 'Mine' }).expect(201);
      taskId = task.body.id;
      await ctx.http().get('/auth/me').set('Cookie', access(jar)).expect(200); // works before
      await setActive(user.id, false);
    });

    it.each([
      ['GET', '/auth/me'],
      ['GET', '/todos'],
      ['POST', '/todos'],
      ['GET', '/todos/:id'],
      ['PATCH', '/todos/:id'],
      ['DELETE', '/todos/:id'],
      ['GET', '/users/options'],
    ])('%s %s → 401', async (method, path) => {
      const url = path.replace(':id', taskId);
      const req = ctx.http()[method.toLowerCase() as 'get'](url).set('Cookie', access(jar));
      const res = await (method === 'GET' || method === 'DELETE' ? req : req.send({ title: 'x' }));
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
    });

    it('the old refresh token is revoked → 401', async () => {
      await ctx.http().post('/auth/refresh').set('Cookie', refresh(jar)).expect(401);
    });

    it('login fails with the same generic message as a wrong password', async () => {
      const disabled = await ctx.http().post('/auth/login').set('X-Forwarded-For', nextIp()).send({ email: user.email, password: PASSWORD }).expect(401);
      const wrong = await ctx.http().post('/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'owner@test.local', password: 'wrong-password' }).expect(401);
      expect(disabled.body).toEqual(wrong.body);
    });

    it('re-enabling does not bring the old token back (token_version moved on)', async () => {
      await setActive(user.id, true);
      await ctx.http().get('/auth/me').set('Cookie', access(jar)).expect(401);
      const fresh = await login(ctx, user.email);
      await ctx.http().get('/auth/me').set('Cookie', access(fresh)).expect(200);
    });
  });

  it('a user disabled directly in the database is rejected on the next request', async () => {
    const user = await createUser(ctx.dataSource, 'direct@test.local', Role.Manager);
    const jar = await login(ctx, user.email);
    await ctx.http().get('/todos').set('Cookie', access(jar)).expect(200);
    await ctx.dataSource.getRepository(User).update({ id: user.id }, { isActive: false });
    await ctx.http().get('/todos').set('Cookie', access(jar)).expect(401);
  });

  it('a role change also ends the old session', async () => {
    const user = await createUser(ctx.dataSource, 'promoted@test.local', Role.Member);
    const jar = await login(ctx, user.email);
    await ctx.http().patch(`/users/${user.id}`).set('Cookie', access(ownerJar)).send({ role: Role.Manager }).expect(200);
    await ctx.http().get('/auth/me').set('Cookie', access(jar)).expect(401);
    const fresh = await login(ctx, user.email);
    const me = await ctx.http().get('/auth/me').set('Cookie', access(fresh)).expect(200);
    expect(me.body.role).toBe(Role.Manager);
  });
});
