/**
 * Navigation config — slim scaffold (login + home).
 */

import { isAdmin } from '@/lib/config/auth';

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
  {
    path: '/subjects',
    name: 'Subjects',
    titleKey: 'ROUTER.SUBJECTS',
    children: [
      {
        path: '',
        name: 'SubjectsIndex',
        titleKey: 'ROUTER.SUBJECTS',
      },
    ],
  },
  {
    path: '/channels',
    name: 'Channels',
    titleKey: 'ROUTER.CHANNELS',
    children: [
      {
        path: '',
        name: 'ChannelsIndex',
        titleKey: 'ROUTER.CHANNELS',
      },
    ],
  },
  {
    path: '/users',
    name: 'Users',
    titleKey: 'ROUTER.USERS',
    meta: { roles: ['admin'] },
    children: [
      {
        path: '',
        name: 'UsersIndex',
        titleKey: 'ROUTER.USERS',
      },
    ],
  },
  {
    path: '/schedules',
    name: 'Schedules',
    titleKey: 'ROUTER.SCHEDULES',
    meta: { roles: ['admin'] },
    children: [
      {
        path: '',
        name: 'SchedulesIndex',
        titleKey: 'ROUTER.SCHEDULES',
      },
    ],
  },
  {
    path: '/settings',
    name: 'Settings',
    titleKey: 'ROUTER.SETTINGS',
    meta: { roles: ['admin'] },
    children: [
      {
        path: '',
        name: 'SettingsIndex',
        titleKey: 'ROUTER.SETTINGS',
      },
    ],
  },
];

export function getPermissionNavModules(
  role?: string | number,
  _permissions: string[] = []
): NavModule[] {
  return asyncNavModules.filter((route) => {
    if (route.hidden) return false;
    if (route.meta?.roles?.includes('admin')) {
      return isAdmin(role);
    }
    return true;
  });
}

export function canAccessPathname(
  pathname: string,
  role?: string | number,
  _permissions: string[] = []
): boolean {
  if (pathname === '/home' || pathname.startsWith('/home/')) {
    return true;
  }
  if (pathname === '/subjects' || pathname.startsWith('/subjects/')) {
    return true;
  }
  if (pathname === '/channels' || pathname.startsWith('/channels/')) {
    return true;
  }
  if (pathname === '/users' || pathname.startsWith('/users/')) {
    return isAdmin(role);
  }
  if (pathname === '/schedules' || pathname.startsWith('/schedules/')) {
    return isAdmin(role);
  }
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return isAdmin(role);
  }
  return asyncNavModules.some((mod) => pathname === mod.path || pathname.startsWith(`${mod.path}/`));
}

export function buildNavHref(modulePath: string, childPath: string): string {
  if (!childPath) {
    return modulePath;
  }
  return `${modulePath}/${childPath}`.replace(/\/+/g, '/');
}
