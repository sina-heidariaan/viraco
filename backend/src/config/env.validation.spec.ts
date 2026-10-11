// Nest loads this in the app; class-transformer needs it for the decorators.
import 'reflect-metadata';
import { envWarnings, findEnvProblems, PLACEHOLDER_JWT_SECRET, validateEnv } from './env.validation';

const GOOD = {
  DATABASE_URL: 'postgres://taskboard:taskboard@localhost:5433/taskboard',
  JWT_ACCESS_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789ABCD',
};

describe('findEnvProblems', () => {
  it('a complete environment has no problems', () => {
    expect(findEnvProblems(GOOD)).toEqual([]);
  });

  it('names each missing variable once and says what to set', () => {
    expect(findEnvProblems({})).toEqual([
      'DATABASE_URL is missing. Set it to a postgres:// URL, e.g. the one in backend/.env.example.',
      expect.stringMatching(/^JWT_ACCESS_SECRET is missing\. Set it to a random string of at least 32 characters\. Generate one with: node -e /),
    ]);
  });

  it('an empty value counts as missing', () => {
    expect(findEnvProblems({ ...GOOD, DATABASE_URL: '' })).toEqual([
      'DATABASE_URL is missing. Set it to a postgres:// URL, e.g. the one in backend/.env.example.',
    ]);
  });

  it('a value that is set but wrong is "invalid", one line per variable', () => {
    expect(findEnvProblems({ ...GOOD, JWT_ACCESS_SECRET: 'short', PORT: 'abc', DATABASE_URL: 'mysql://x' })).toEqual([
      'PORT is invalid. Set it to a whole number from 1 to 65535.',
      'DATABASE_URL is invalid. Set it to a postgres:// URL, e.g. the one in backend/.env.example.',
      expect.stringMatching(/^JWT_ACCESS_SECRET is invalid\. Set it to a random string of at least 32 characters\./),
    ]);
  });

  it('production needs secure cookies', () => {
    expect(findEnvProblems({ ...GOOD, NODE_ENV: 'production' })).toEqual([
      'COOKIE_SECURE must be true when NODE_ENV=production. Set COOKIE_SECURE=true and serve the app over HTTPS.',
    ]);
    expect(findEnvProblems({ ...GOOD, NODE_ENV: 'production', COOKIE_SECURE: 'true' })).toEqual([]);
  });
});

describe('validateEnv (used by ConfigModule)', () => {
  it('returns typed values with defaults', () => {
    expect(validateEnv(GOOD)).toMatchObject({ PORT: 4000, COOKIE_SECURE: false, NODE_ENV: 'development' });
  });

  it('throws the same lines', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: GOOD.JWT_ACCESS_SECRET })).toThrow(
      'Invalid environment:\n- DATABASE_URL is missing.',
    );
  });
});

describe('envWarnings', () => {
  it('warns when the JWT secret is still the .env.example placeholder', () => {
    expect(envWarnings({ ...GOOD, JWT_ACCESS_SECRET: PLACEHOLDER_JWT_SECRET })).toEqual([
      expect.stringMatching(/^JWT_ACCESS_SECRET is the example value from \.env\.example\. Anyone who has read that file can sign in as any user/),
    ]);
  });

  it('is silent for any other secret', () => {
    expect(envWarnings(GOOD)).toEqual([]);
  });
});
