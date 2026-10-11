import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsString()
  HOST: string = '127.0.0.1';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @Matches(/^postgres(ql)?:\/\/.+/, { message: 'DATABASE_URL must be a postgres:// URL' })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS: number = 7;

  // Implicit conversion runs before @Transform and turns "false" into true,
  // so read the raw value from the source object.
  @Transform(({ obj, key }) => {
    const raw: unknown = (obj as Record<string, unknown>)[key];
    return raw === true || raw === 'true';
  })
  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  @Matches(/^\/.*/, { message: 'REFRESH_COOKIE_PATH must start with /' })
  REFRESH_COOKIE_PATH: string = '/api/v1/auth';
}

const GENERATE_SECRET = `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`;

/** What to do for each variable; every error line ends with it. */
const HINTS: Record<keyof EnvironmentVariables, string> = {
  NODE_ENV: 'Set it to development, test or production.',
  HOST: 'Set it to a host name or IP address, e.g. 127.0.0.1.',
  PORT: 'Set it to a whole number from 1 to 65535.',
  DATABASE_URL: 'Set it to a postgres:// URL, e.g. the one in backend/.env.example.',
  JWT_ACCESS_SECRET: `Set it to a random string of at least 32 characters. Generate one with: ${GENERATE_SECRET}`,
  JWT_ACCESS_TTL_SECONDS: 'Set it to a whole number of seconds, at least 60.',
  REFRESH_TOKEN_TTL_DAYS: 'Set it to a whole number of days, at least 1.',
  COOKIE_SECURE: 'Set it to true or false.',
  REFRESH_COOKIE_PATH: 'Set it to a path that starts with /, e.g. /api/v1/auth.',
};

/** The JWT_ACCESS_SECRET value shipped in backend/.env.example (public). */
export const PLACEHOLDER_JWT_SECRET = 'replace-with-a-random-string-of-at-least-32-characters';

function check(config: Record<string, unknown>): { env: EnvironmentVariables; problems: string[] } {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  // One line per variable: "missing" when unset or empty, else "invalid", then what to do.
  const problems = validateSync(env, { skipMissingProperties: false, stopAtFirstError: true }).map((e) => {
    const raw = config[e.property];
    const state = raw === undefined || raw === '' ? 'missing' : 'invalid';
    return `${e.property} is ${state}. ${HINTS[e.property as keyof EnvironmentVariables]}`;
  });

  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
    problems.push('COOKIE_SECURE must be true when NODE_ENV=production. Set COOKIE_SECURE=true and serve the app over HTTPS.');
  }
  return { env, problems };
}

/** Every problem with the environment, as plain lines; empty when it is valid. */
export function findEnvProblems(config: Record<string, unknown>): string[] {
  return check(config).problems;
}

/** Fails fast at startup when the environment is missing or unsafe (ConfigModule `validate`). */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const { env, problems } = check(config);
  if (problems.length > 0) {
    throw new Error(`Invalid environment:\n- ${problems.join('\n- ')}`);
  }
  return env;
}

/** Unsafe but allowed settings: logged at startup, never blocking (S7 review F2, user decision). */
export function envWarnings(config: Record<string, unknown>): string[] {
  if (config.JWT_ACCESS_SECRET !== PLACEHOLDER_JWT_SECRET) return [];
  return [
    'JWT_ACCESS_SECRET is the example value from .env.example. Anyone who has read that file can sign in as any user, ' +
      `including the owner. Replace it with a new secret: ${GENERATE_SECRET}`,
  ];
}
