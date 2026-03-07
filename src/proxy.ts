import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas que requieren estar autenticado
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/daily',
  '/extra-saving',
  '/goals',
  '/history',
  '/profile',
  '/settings',
  '/impact',
  '/home',
  '/onboarding',
];

// Rutas públicas (no redirigir aunque no haya sesión)
const PUBLIC_PATHS = ['/signup', '/login', '/register', '/auth', '/privacy', '/terms', '/'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isPublic) return NextResponse.next();

  // Verificar cookie de sesión establecida por authService.ts
  const authCookie = request.cookies.get('ai_auth');
  if (!authCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)).*)',
  ],
};
