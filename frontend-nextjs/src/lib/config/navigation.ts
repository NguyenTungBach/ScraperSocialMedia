/**
 * Navigation config — slim scaffold (login + home).
 */

export const DEFAULT_AFTER_LOGIN = '/home';

export interface NavRouteMeta {
  roles?: string[];
  permissions?: string[];
}

export interface NavRoute {
  path: string;
  name: string;
  titleKey: string;
  hidden?: boolean;
  meta?: NavRouteMeta;
  children?: NavRoute[];
}

export interface NavModule {
  path: string;
  name: string;
  titleKey: string;
  hidden?: boolean;
  meta?: NavRouteMeta;
  children?: NavRoute[];
}

export const asyncNavModules: NavModule[] = [
  {
    path: '/home',
    name: 'Home',
    titleKey: 'ROUTER.HOME',
    children: [
      {
        path: '',
        name: 'HomeIndex',
        titleKey: 'ROUTER.HOME',
      },
    ],
  },
];

export function getPermissionNavModules(
  _role?: string | number,
  _permissions: string[] = []
): NavModule[] {
  return asyncNavModules.filter((route) => route.hidden !== true);
}

export function canAccessPathname(
  pathname: string,
  _role?: string | number,
  _permissions: string[] = []
): boolean {
  if (pathname === '/home' || pathname.startsWith('/home/')) {
    return true;
  }
  return asyncNavModules.some((mod) => pathname === mod.path || pathname.startsWith(`${mod.path}/`));
}

export function buildNavHref(modulePath: string, childPath: string): string {
  if (!childPath) {
    return modulePath;
  }
  return `${modulePath}/${childPath}`.replace(/\/+/g, '/');
}
