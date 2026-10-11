import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips AuthGuard. Every route without it requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
