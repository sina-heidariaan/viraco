import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

/** Trims strings; leaves other values for the validators to reject. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * Validate when the field is present, including `null`. Unlike @IsOptional, a
 * `null` sent for a NOT NULL column fails validation instead of reaching the DB.
 */
export const IfPresent = () => ValidateIf((_obj: object, value: unknown) => value !== undefined);
