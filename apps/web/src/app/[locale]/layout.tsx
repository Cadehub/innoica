import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <title>Innoica Agent Studio — Turn Complexity Into Simplicity</title>
        <meta
          name="description"
          content="Innoica Agent Studio : plateforme SaaS d'agents IA autonomes sur WhatsApp avec contrôle humain en temps réel."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="icon" href="/images/innoica-logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/images/innoica-logo.jpg" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09090b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="INNOICA" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[PWA] Service Worker actif');
                  }).catch(function(err) {
                    console.warn('[PWA] Échec enregistrement SW:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#fafafb] text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
