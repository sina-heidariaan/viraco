import { testDatabaseUrl } from './test-db';

// Runs before each test file's imports. process.env wins over backend/.env in
// @nestjs/config, so the app under test always uses the test database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_ACCESS_SECRET = 'e2e-only-secret-that-is-longer-than-32-characters';
process.env.COOKIE_SECURE = 'false';
