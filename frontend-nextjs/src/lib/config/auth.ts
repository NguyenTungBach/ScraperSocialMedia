/** Role helpers — admin full access, member read-only. */
export const ROLE_ADMIN = 'admin';
export const ROLE_MEMBER = 'member';

export const isAdmin = (role?: string | number | null): boolean =>
  String(role ?? '').toLowerCase() === ROLE_ADMIN;

export const canWrite = (role?: string | number | null): boolean => isAdmin(role);
