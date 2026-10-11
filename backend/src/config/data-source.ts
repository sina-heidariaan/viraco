import { join } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { RefreshToken } from '../modules/auth/refresh-token.entity';
import { Todo } from '../modules/todos/todo.entity';
import { User } from '../modules/users/user.entity';

/**
 * Single source of database settings, used by the Nest app, the TypeORM CLI,
 * the seed script and the e2e tests. The schema is changed only by migrations.
 */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    // gen_random_uuid() is built into PostgreSQL 13+, so no extension is needed.
    uuidExtension: 'pgcrypto',
    entities: [User, RefreshToken, Todo],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
  };
}

// Default export is what the TypeORM CLI loads (`-d src/config/data-source.ts`).
export default new DataSource(buildDataSourceOptions(process.env.DATABASE_URL ?? ''));
