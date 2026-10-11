import { Role } from '../../src/modules/users/role.enum';
import { User } from '../../src/modules/users/user.entity';
import { access, createTestApp, createUser, login, TestContext } from './support/app';

// Plan §9 required test 2: a member (and a manager) cannot modify users.
describe('Only the owner can manage users', () => {
  let ctx: TestContext;
  let owner: User;
  let member: User;
  let manager: User;
  let jar: Record<string, Record<string, string>>;
  const newUser = { email: 'new@test.local', name: 'New', password: 'Password1', role: Role.Member };
  const forbidden = { statusCode: 403, error: 'Forbidden', message: 'Forbidden', details: [] };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await createUser(ctx.dataSource, 'owner@test.local', Role.Owner);
    manager = await createUser(ctx.dataSource, 'manager@test.local', Role.Manager);
    member = await createUser(ctx.dataSource, 'member@test.local', Role.Member);
    jar = {
      owner: await login(ctx, 'owner@test.local'),
      manager: await login(ctx, 'manager@test.local'),
      member: await login(ctx, 'member@test.local'),
    };
  });

  afterAll(() => ctx.app.close());

  const users = () => ctx.dataSource.getRepository(User);

  describe.each(['member', 'manager'])('as %s', (who) => {
    it('GET /users → 403', async () => {
      const res = await ctx.http().get('/users').set('Cookie', access(jar[who])).expect(403);
      expect(res.body).toEqual(forbidden);
    });

    it('POST /users → 403 and no user is created', async () => {
      await ctx.http().post('/users').set('Cookie', access(jar[who])).send(newUser).expect(403);
      expect(await users().countBy({ email: newUser.email })).toBe(0);
    });

    it('PATCH /users/:id → 403 and the target is unchanged', async () => {
      await ctx.http().patch(`/users/${owner.id}`).set('Cookie', access(jar[who])).send({ isActive: false, role: Role.Member }).expect(403);
      const after = await users().findOneByOrFail({ id: owner.id });
      expect([after.isActive, after.role]).toEqual([true, Role.Owner]);
    });

    it('cannot promote themselves to owner', async () => {
      const self = who === 'member' ? member : manager;
      await ctx.http().patch(`/users/${self.id}`).set('Cookie', access(jar[who])).send({ role: Role.Owner }).expect(403);
      expect((await users().findOneByOrFail({ id: self.id })).role).toBe(self.role);
    });
  });

  it('GET /users/options: member 403, manager 200 with {id, name} only', async () => {
    await ctx.http().get('/users/options').set('Cookie', access(jar.member)).expect(403);
    const res = await ctx.http().get('/users/options').set('Cookie', access(jar.manager)).expect(200);
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'name']);
  });

  it('the owner (control) can list, create and edit users; no password hash is returned', async () => {
    const list = await ctx.http().get('/users').set('Cookie', access(jar.owner)).expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/password/i);
    const created = await ctx.http().post('/users').set('Cookie', access(jar.owner)).send(newUser).expect(201);
    await ctx.http().patch(`/users/${created.body.id}`).set('Cookie', access(jar.owner)).send({ name: 'Renamed' }).expect(200);
  });

  it('the last active owner cannot disable or downgrade themselves (409)', async () => {
    await ctx.http().patch(`/users/${owner.id}`).set('Cookie', access(jar.owner)).send({ isActive: false }).expect(409);
    await ctx.http().patch(`/users/${owner.id}`).set('Cookie', access(jar.owner)).send({ role: Role.Manager }).expect(409);
    const after = await users().findOneByOrFail({ id: owner.id });
    expect([after.isActive, after.role]).toEqual([true, Role.Owner]);
  });
});
