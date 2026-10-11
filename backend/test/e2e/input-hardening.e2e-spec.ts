import { Role } from '../../src/modules/users/role.enum';
import { access, createTestApp, createUser, login, TestContext } from './support/app';

const badRequest = (field: string, message: string) => ({
  statusCode: 400,
  error: 'Bad Request',
  message: 'Validation failed',
  details: [{ field, message }],
});

/** Built as a string: JSON.stringify itself overflows the stack at a few thousand levels. */
const nestedBlockquotes = (levels: number): string =>
  '{"type":"doc","content":[' +
  '{"type":"blockquote","content":['.repeat(levels) +
  ']}'.repeat(levels) +
  ']}';

describe('Malformed input gets a 400 with a field error, never a 500', () => {
  let ctx: TestContext;
  let owner: Record<string, string>;
  let ownerId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ownerId = (await createUser(ctx.dataSource, 'owner@test.local', Role.Owner)).id;
    owner = await login(ctx, 'owner@test.local');
  });

  afterAll(() => ctx.app.close());

  const postRaw = (json: string) =>
    ctx.http().post('/todos').set('Cookie', access(owner)).set('Content-Type', 'application/json').send(json);

  // F3: class-transformer recursed into the whole body and overflowed the stack.
  it('a description nested 2000 levels deep → 400 on description', async () => {
    const res = await postRaw(`{"title":"t","description":${nestedBlockquotes(2000)}}`).expect(400);
    expect(res.body).toEqual(badRequest('description', 'description is nested too deeply'));
  });

  it('a deeply nested array in title → 400 on title', async () => {
    const res = await postRaw(`{"title":${'['.repeat(5000)}${']'.repeat(5000)}}`).expect(400);
    expect(res.body).toEqual(badRequest('title', 'title is nested too deeply'));
  });

  it('the deepest valid TipTap doc (20 levels, link at the bottom) is still accepted', async () => {
    let node: object = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }],
    };
    for (let depth = 18; depth > 1; depth--) node = { type: 'blockquote', content: [node] };
    await ctx.http().post('/todos').set('Cookie', access(owner))
      .send({ title: 'deep but valid', description: { type: 'doc', content: [node] } })
      .expect(201);
  });

  // F11: ParseUUIDPipe answered with an empty `details` list.
  it.each([
    ['get', '/todos/not-a-uuid'],
    ['patch', '/todos/not-a-uuid'],
    ['delete', '/todos/not-a-uuid'],
    ['patch', '/users/not-a-uuid'],
  ] as const)('%s %s → 400 with a field error on id', async (method, path) => {
    const res = await ctx.http()[method](path).set('Cookie', access(owner)).send({}).expect(400);
    expect(res.body).toEqual(badRequest('id', 'id must be a UUID'));
  });

  it('a valid uuid still reaches the handler', async () => {
    await ctx.http().patch(`/users/${ownerId}`).set('Cookie', access(owner)).send({ name: 'Owner' }).expect(200);
  });

  // F8: TypeORM ran CREATE EXTENSION on every connect; schema changes belong in migrations.
  it('starting the app installs no PostgreSQL extension', async () => {
    const rows: unknown[] = await ctx.dataSource.query(`SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`);
    expect(rows).toEqual([]);
  });
});
