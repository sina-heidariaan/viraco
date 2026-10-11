// TypeORM loads migration files with a plain require(); jest's transform does not
// cover that inside globalSetup, so register ts-node for the .ts migrations.
import 'ts-node/register/transpile-only';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../../src/config/data-source';
import { testDatabaseUrl } from './test-db';

/** Once per run: empty the test database and build the schema from the migrations (never synchronize). */
export default async function globalSetup(): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions(testDatabaseUrl()));
  await dataSource.initialize();
  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations({ transaction: 'all' });
  } finally {
    await dataSource.destroy();
  }
}
