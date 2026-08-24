/**
 * Temporary auth bypass — set `NEXT_PUBLIC_AUTH_REQUIRED=true` to re-enable login.
 * Default: auth OFF for local scaffold.
 */
export const isAuthRequired = (): boolean =>
  process.env.NEXT_PUBLIC_AUTH_REQUIRED === 'true';
