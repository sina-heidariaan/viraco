import { Role } from '../../src/modules/users/role.enum';
import { User } from '../../src/modules/users/user.entity';
import { access, createTestApp, createUser, login, TestContext } from './support/app';

// Plan §5.1 task rows: what a member may do on tasks they can see, and manager full access.
describe('Task permission matrix', () => {
  let ctx: TestContext;
  let member: User;
  let manager: User;
  let jar: Record<string, Record<string, string>>;

  const as = (who: string) => ({
    post: (body: object) => ctx.http().post('/todos').set('Cookie', access(jar[who])).send(body),
    patch: (id: string, body: object) => ctx.http().patch(`/todos/${id}`).set('Cookie', access(jar[who])).send(body),
    del: (id: string) => ctx.http().delete(`/todos/${id}`).set('Cookie', access(jar[who])),
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    manager = await createUser(ctx.dataSource, 'manager@test.local', Role.Manager);
    member = await createUser(ctx.dataSource, 'member@test.local', Role.Member);
    jar = { manager: await login(ctx, 'manager@test.local'), member: await login(ctx, 'member@test.local') };
  });

  afterAll(() => ctx.app.close());

  describe('member creating', () => {
    it('cannot assign a new task to someone else (403)', async () => {
      await as('member').post({ title: 'For manager', assigneeId: manager.id }).expect(403);
    });

    it('may assign it to themselves or leave it unassigned', async () => {
      await as('member').post({ title: 'For me', assigneeId: member.id }).expect(201);
      await as('member').post({ title: 'Nobody' }).expect(201);
    });
  });

  describe('member on a task assigned to them by someone else', () => {
    let id: string;
    beforeEach(async () => {
      id = (await as('manager').post({ title: 'Assigned', assigneeId: member.id }).expect(201)).body.id;
    });

    it('may edit its fields (AS1)', async () => {
      const res = await as('member').patch(id, { status: 'done', title: 'Edited' }).expect(200);
      expect(res.body).toMatchObject({ status: 'done', title: 'Edited' });
    });

    it('cannot change its assignee (403)', async () => {
      await as('member').patch(id, { assigneeId: null }).expect(403);
    });

    it('cannot delete it (403)', async () => {
      await as('member').del(id).expect(403);
    });
  });

  describe('member on a task they created', () => {
    let id: string;
    beforeEach(async () => {
      id = (await as('member').post({ title: 'Mine', assigneeId: member.id }).expect(201)).body.id;
    });

    it('cannot reassign it to someone else (403), may unassign it', async () => {
      await as('member').patch(id, { assigneeId: manager.id }).expect(403);
      await as('member').patch(id, { assigneeId: null }).expect(200);
    });

    it('may delete it', async () => {
      await as('member').del(id).expect(204);
    });
  });

  describe('manager', () => {
    it('may edit, reassign and delete any task', async () => {
      const id = (await as('member').post({ title: 'Member made' }).expect(201)).body.id;
      await as('manager').patch(id, { title: 'Changed', assigneeId: manager.id }).expect(200);
      await as('manager').del(id).expect(204);
    });

    it('cannot make a disabled user the new assignee (400), but existing assignments stay', async () => {
      const gone = await createUser(ctx.dataSource, 'gone@test.local', Role.Member);
      const id = (await as('manager').post({ title: 'Kept', assigneeId: gone.id }).expect(201)).body.id;
      await ctx.dataSource.getRepository(User).update({ id: gone.id }, { isActive: false });

      const res = await as('manager').post({ title: 'New', assigneeId: gone.id }).expect(400);
      expect(res.body.details).toEqual([{ field: 'assigneeId', message: 'Assignee must be an active user' }]);
      const kept = await as('manager').patch(id, { title: 'Kept, edited' }).expect(200);
      expect(kept.body.assignee).toEqual({ id: gone.id, name: gone.name });
    });
  });

  it('the API rejects a description with a javascript: link (validator is wired in)', async () => {
    const description = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }],
    };
    const res = await as('manager').post({ title: 'XSS', description }).expect(400);
    expect(res.body.details[0].field).toBe('description');
  });

  it('a stored description comes back exactly as sent', async () => {
    const description = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'عنوان' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'پیوند', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] },
      ],
    };
    const id = (await as('manager').post({ title: 'Round trip', description }).expect(201)).body.id;
    const res = await ctx.http().get(`/todos/${id}`).set('Cookie', access(jar.manager)).expect(200);
    expect(res.body.description).toEqual(description);
  });
});
