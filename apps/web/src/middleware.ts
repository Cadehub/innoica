import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames, excluding static assets and API routes
  matcher: ['/', '/(fr|en)/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
