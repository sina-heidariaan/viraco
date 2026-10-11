import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { buildDataSourceOptions } from '../../config/data-source';
import { Todo, TodoPriority, TodoStatus } from '../../modules/todos/todo.entity';
import { TiptapDoc, TiptapNode } from '../../modules/todos/tiptap/tiptap.types';
import { Role } from '../../modules/users/role.enum';
import { User } from '../../modules/users/user.entity';

interface SeedUser {
  role: Role;
  name: string;
  email: string;
  password: string;
}

const isProduction = process.env.NODE_ENV === 'production';

function seedUser(role: Role, name: string, prefix: string, devPassword: string): SeedUser {
  const email = (process.env[`SEED_${prefix}_EMAIL`] || `${role}@taskboard.local`).toLowerCase();
  const password = process.env[`SEED_${prefix}_PASSWORD`] || '';
  if (!password && isProduction) {
    throw new Error(`SEED_${prefix}_PASSWORD is required when NODE_ENV=production`);
  }
  return { role, name, email, password: password || devPassword };
}

/**
 * Inserts a user only if the email is not taken. An existing user is never changed,
 * so re-running the seed cannot reset a password or a role. Returns the stored user.
 */
async function ensureUser(manager: EntityManager, u: SeedUser): Promise<{ user: User; created: boolean }> {
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(User)
    .values({
      email: u.email,
      name: u.name,
      role: u.role,
      passwordHash: await argon2.hash(u.password, { type: argon2.argon2id }),
    })
    .orIgnore() // ON CONFLICT DO NOTHING — safe against concurrent runs too
    .execute();

  const user = await manager.findOneByOrFail(User, { email: u.email });
  // Postgres returns the inserted row via RETURNING; a skipped (conflicting) insert returns none.
  const created = Array.isArray(result.raw) && result.raw.length > 0;
  return { user, created };
}

function doc(...content: TiptapNode[]): TiptapDoc {
  return { type: 'doc', content };
}

function sampleTodos(owner: User, manager: User, member: User): DeepPartial<Todo>[] {
  return [
    {
      title: 'طراحی صفحه ورود',
      status: TodoStatus.Done,
      priority: TodoPriority.High,
      createdById: manager.id,
      assigneeId: member.id,
      description: doc(
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'نیازمندی‌ها' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'راست‌چین و فارسی' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'پیام خطای واضح', marks: [{ type: 'bold' }] }] }] },
          ],
        },
      ),
    },
    {
      title: 'نوشتن تست‌های دسترسی',
      status: TodoStatus.InProgress,
      priority: TodoPriority.High,
      createdById: manager.id,
      assigneeId: member.id,
      dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      description: doc({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'راهنما: ' },
          {
            type: 'text',
            text: 'مستندات NestJS',
            marks: [{ type: 'link', attrs: { href: 'https://docs.nestjs.com' } }],
          },
        ],
      }),
    },
    {
      title: 'یادداشت شخصی عضو تیم',
      status: TodoStatus.Todo,
      priority: TodoPriority.Low,
      createdById: member.id,
      assigneeId: member.id,
    },
    {
      title: 'بازبینی نقش کاربران',
      status: TodoStatus.Todo,
      priority: TodoPriority.Medium,
      createdById: owner.id,
      assigneeId: manager.id,
      description: doc({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'فقط مالک می‌تواند نقش‌ها را تغییر دهد.', marks: [{ type: 'italic' }] }] }],
      }),
    },
  ];
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const users = [
    seedUser(Role.Owner, 'مالک سیستم', 'OWNER', 'Owner@12345'),
    seedUser(Role.Manager, 'مدیر پروژه', 'MANAGER', 'Manager@12345'),
    seedUser(Role.Member, 'عضو تیم', 'MEMBER', 'Member@12345'),
  ];

  const dataSource = new DataSource(buildDataSourceOptions(url));
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const stored: User[] = [];
      for (const u of users) {
        const { user, created } = await ensureUser(manager, u);
        stored.push(user);
        console.log(`${created ? 'created ' : 'exists  '} ${u.role.padEnd(7)} ${u.email}`);
      }

      // Demo tasks only on an empty table, so re-running never duplicates them.
      if ((await manager.count(Todo)) === 0) {
        const [owner, managerUser, member] = stored;
        await manager.save(manager.create(Todo, sampleTodos(owner, managerUser, member)));
        console.log('created  sample tasks');
      } else {
        console.log('skipped  sample tasks (todos table not empty)');
      }
    });
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
