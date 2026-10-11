import { Role } from '../../src/modules/users/role.enum';
import { User } from '../../src/modules/users/user.entity';
import { Todo } from '../../src/modules/todos/todo.entity';
import { access, createTestApp, createUser, login, TestContext } from './support/app';

// Plan §9 required test 1: a member cannot view another user's task.
describe('Member cannot view another user’s task', () => {
  let ctx: TestContext;
  let member: User;
  let other: User;
  let jar: Record<string, Record<string, string>>;
  const ids: Record<string, string> = {};

  const create = async (who: string, body: object): Promise<string> => {
    const res = await ctx.http().post('/todos').set('Cookie', access(jar[who])).send(body).expect(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await createUser(ctx.dataSource, 'owner@test.local', Role.Owner);
    member = await createUser(ctx.dataSource, 'member@test.local', Role.Member);
    other = await createUser(ctx.dataSource, 'other@test.local', Role.Member);
    jar = {
      owner: await login(ctx, 'owner@test.local'),
      member: await login(ctx, 'member@test.local'),
      other: await login(ctx, 'other@test.local'),
    };
    ids.otherMembers = await create('other', { title: 'Other member’s task' });
    ids.ownersUnassigned = await create('owner', { title: 'Owner task, unassigned' });
    ids.ownersForOther = await create('owner', { title: 'Owner task for other', assigneeId: other.id });
    ids.assignedToMember = await create('owner', { title: 'Owner task for member', assigneeId: member.id });
    ids.membersOwn = await create('member', { title: 'Member’s own task' });
  });

  afterAll(() => ctx.app.close());

  it('GET /todos returns only tasks the member created or is assigned to', async () => {
    const res = await ctx.http().get('/todos').set('Cookie', access(jar.member)).expect(200);
    const listed = (res.body as Array<{ id: string }>).map((t) => t.id).sort();
    expect(listed).toEqual([ids.assignedToMember, ids.membersOwn].sort());
  });

  it.each(['otherMembers', 'ownersUnassigned', 'ownersForOther'])(
    'GET /todos/:id of a task the member cannot see (%s) returns 404, not 403',
    async (key) => {
      const res = await ctx.http().get(`/todos/${ids[key]}`).set('Cookie', access(jar.member)).expect(404);
      expect(res.body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Task not found', details: [] });
    },
  );

  it('a filter cannot widen what a member sees', async () => {
    const res = await ctx.http().get(`/todos?assigneeId=${other.id}`).set('Cookie', access(jar.member)).expect(200);
    expect(res.body).toEqual([]);
  });

  it('PATCH and DELETE on an invisible task return 404 and change nothing', async () => {
    await ctx.http().patch(`/todos/${ids.otherMembers}`).set('Cookie', access(jar.member)).send({ title: 'hacked' }).expect(404);
    await ctx.http().delete(`/todos/${ids.otherMembers}`).set('Cookie', access(jar.member)).expect(404);
    const row = await ctx.dataSource.getRepository(Todo).findOneByOrFail({ id: ids.otherMembers });
    expect(row.title).toBe('Other member’s task');
  });

  it('the owner (control) sees every task', async () => {
    const res = await ctx.http().get('/todos').set('Cookie', access(jar.owner)).expect(200);
    expect(res.body).toHaveLength(5);
  });
});
