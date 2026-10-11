/**
 * The e2e tests wipe their database, so they only ever run against a database
 * whose name ends in `_test` (plan §4.3: `taskboard_test`, same container as dev).
 */
const DEFAULT_TEST_DATABASE_URL = 'postgres://taskboard:taskboard@localhost:5433/taskboard_test';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests against "${dbName}": the database name must end in _test`);
  }
  return url;
}
