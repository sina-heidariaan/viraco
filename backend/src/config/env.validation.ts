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

/** Fails fast at startup when the environment is missing or unsafe. */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(env, { skipMissingProperties: false });
  const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));

  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
    messages.push('COOKIE_SECURE must be true in production');
  }
  if (messages.length > 0) {
    throw new Error(`Invalid environment:\n- ${messages.join('\n- ')}`);
  }
  return env;
}
