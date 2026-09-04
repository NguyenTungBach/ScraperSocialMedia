import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPathname, DEFAULT_AFTER_LOGIN } from '@/lib/config/navigation';
import { isPublicRoute } from '@/lib/config/routes';

function getRoleFromRequest(request: NextRequest): string | undefined {
  const raw = request.cookies.get('user_info')?.value;
  if (!raw) {
    return undefined;
  }

  try {
    const profile = JSON.parse(raw) as { role?: string | number };
    return profile.role != null ? String(profile.role) : undefined;
  } catch {
    return undefined;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;

  if (isPublicRoute(pathname)) {
    if ((pathname === '/' || pathname.startsWith('/login')) && token) {
      return NextResponse.redirect(new URL(DEFAULT_AFTER_LOGIN, request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = getRoleFromRequest(request);
  if (role && !canAccessPathname(pathname, role)) {
    return NextResponse.redirect(new URL(DEFAULT_AFTER_LOGIN, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
