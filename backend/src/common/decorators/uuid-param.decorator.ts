import { BadRequestException, Param, ParseUUIDPipe } from '@nestjs/common';

/** Route param that must be a UUID; a bad value is a 400 with a field error, like any DTO field. */
export const UuidParam = (name: string) =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () =>
        new BadRequestException({ message: 'Validation failed', details: [{ field: name, message: `${name} must be a UUID` }] }),
    }),
  );
