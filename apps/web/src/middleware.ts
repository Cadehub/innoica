// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Hybrid Multi-Tenant Routing Middleware
// Multi-tenant subdomain routing & next-intl internationalization (Requirement R4)
// ====================================================================

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { RESERVED_STORE_SLUGS, slugRegex } from '@innoica/shared';

const handleI18nRouting = createMiddleware(routing);

// Chemins du dashboard/admin réservés à la plateforme SaaS
const PLATFORM_ONLY_PREFIXES = [
  '/dashboard',
  '/admin',
  '/agents',
  '/ai-credentials',
  '/conversations',
  '/knowledge',
  '/whatsapp',
  '/subscription',
  '/settings',
  '/login',
  '/register',
];

/**
 * Extrait le sous-domaine de boutique depuis l'en-tête Host ou x-forwarded-host
 */
export function extractStoreSubdomain(req: NextRequest): string | null {
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    req.nextUrl.host;
  if (!host) return null;

  const hostname = host.split(':')[0].toLowerCase();

  // Rejeter toute tentative de traversée de chemin ou caractères illégaux dans l'en-tête Host
  if (
    !hostname ||
    hostname.includes('..') ||
    hostname.includes('/') ||
    hostname.includes('\\') ||
    hostname.includes('%') ||
    /\s/.test(hostname)
  ) {
    return null;
  }

  // Ignorer les adresses IP pures, localhost brut et previews Vercel
  if (
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    hostname === 'localhost' ||
    hostname.endsWith('.vercel.app')
  ) {
    return null;
  }

  // Support développement local : [slug].localhost
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    const candidate = parts[0];
    if (
      parts.length >= 2 &&
      candidate &&
      parts.slice(0, -1).every((p) => Boolean(p) && slugRegex.test(p)) &&
      !RESERVED_STORE_SLUGS.has(candidate)
    ) {
      return candidate;
    }
    return null;
  }

  // Support production : [slug].[rootDomain]
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'innoica.com').toLowerCase();
  if (hostname.endsWith(`.${rootDomain}`)) {
    const withoutRoot = hostname.slice(0, -(`.${rootDomain}`.length));
    const parts = withoutRoot.split('.');
    const potentialSlug = parts[parts.length - 1];
    if (
      potentialSlug &&
      parts.every((p) => Boolean(p) && slugRegex.test(p)) &&
      !RESERVED_STORE_SLUGS.has(potentialSlug)
    ) {
      return potentialSlug;
    }
  }

  return null;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractStoreSubdomain(request);

  // 1. Si aucun sous-domaine de boutique n'est détecté -> routage standard i18n
  if (!subdomain) {
    return handleI18nRouting(request);
  }

  // 2. Si le visiteur est sur un sous-domaine de boutique mais tente d'accéder au dashboard/admin
  // -> Rediriger vers l'apex domain officiel pour éviter toute confusion
  const hasPlatformPrefix = PLATFORM_ONLY_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`) ||
      pathname === `/fr${prefix}` ||
      pathname.startsWith(`/fr${prefix}/`) ||
      pathname === `/en${prefix}` ||
      pathname.startsWith(`/en${prefix}/`)
  );

  if (hasPlatformPrefix) {
    const rootUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://innoica.com';
    return NextResponse.redirect(new URL(pathname, rootUrl));
  }

  // 3. Extraction de la locale souhaitée (détectée dans l'URL, cookie, ou défaut)
  let locale = routing.defaultLocale;
  let storeInternalPath = pathname;

  if (pathname.startsWith('/en/') || pathname === '/en') {
    locale = 'en';
    storeInternalPath = pathname.slice(3) || '/';
  } else if (pathname.startsWith('/fr/') || pathname === '/fr') {
    locale = 'fr';
    storeInternalPath = pathname.slice(3) || '/';
  } else {
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale && routing.locales.includes(cookieLocale as any)) {
      locale = cookieLocale as any;
    }
  }

  // 4. Éviter le dédoublement si le chemin contient déjà /store/[subdomain]
  if (storeInternalPath.startsWith(`/store/${subdomain}`)) {
    storeInternalPath = storeInternalPath.replace(`/store/${subdomain}`, '') || '/';
  } else if (storeInternalPath.startsWith('/store')) {
    storeInternalPath = storeInternalPath.replace('/store', '') || '/';
  }

  // 5. Réécriture interne transparente vers /[locale]/store/[storeSlug]/...
  const suffix = storeInternalPath === '/' ? '' : storeInternalPath;
  const rewriteDestination = `/${locale}/store/${subdomain}${suffix}`;
  const rewriteUrl = new URL(rewriteDestination, request.url);

  // En-têtes de contexte pour Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-store-slug', subdomain);
  requestHeaders.set('x-tenant-host', request.headers.get('host') || '');
  requestHeaders.set('x-is-subdomain', 'true');
  requestHeaders.set('x-locale', locale);

  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  // Maintien du cookie de langue
  response.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 31536000 });
  return response;
}

export const config = {
  // Exclure les routes API, les internals Next.js et les fichiers statiques de l'internationalisation
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
