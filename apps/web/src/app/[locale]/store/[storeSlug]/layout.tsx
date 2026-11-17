import React from 'react';
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CartProvider } from '@/components/store/cart-context';
import { CartDrawer } from '@/components/store/cart-drawer';
import { StoreHeader } from '@/components/store/store-header';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { FooterSection } from '@/components/storefront/footer-section';

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; storeSlug: string }>;
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string; storeSlug: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, storeSlug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from('store_settings')
    .select('store_name, description, logo_url, banner_url, theme_color')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    return {
      title: 'Boutique introuvable — INNOICA Commerce',
      robots: { index: false, follow: false },
    };
  }

  const title = `${store.store_name} | Boutique en ligne`;
  const description =
    store.description ||
    `Commandez en direct chez ${store.store_name} sur INNOICA. Livraison rapide et paiement sécurisé au Cameroun.`;
  const ogImage = store.banner_url || store.logo_url || '/images/innoica-logo.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: store.store_name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: store.store_name }],
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    icons: {
      icon: store.logo_url || '/images/innoica-logo.jpg',
      apple: store.logo_url || '/images/innoica-logo.jpg',
    },
    alternates: {
      canonical: `/store/${storeSlug}`,
      languages: {
        fr: `/fr/store/${storeSlug}`,
        en: `/en/store/${storeSlug}`,
      },
    },
  };
}

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { storeSlug } = await params;
  const supabase = await createClient();

  // RLS: Anonymous user will only read active store_settings
  const { data: store } = await supabase
    .from('store_settings')
    .select('*')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  const themeColor = store.theme_color || '#25D366';
  const layout = store.builder_layout || {};
  const announcement = layout.announcement || { enabled: true, text: '' };

  return (
    <CartProvider storeSlug={storeSlug}>
      <div
        className="min-h-screen bg-[#fafafb] text-zinc-900 flex flex-col antialiased selection:bg-zinc-900 selection:text-white"
        style={{ '--store-theme': themeColor } as React.CSSProperties}
      >
        {/* Sticky Announcement Bar */}
        {announcement.enabled !== false && (
          <AnnouncementBar
            enabled={true}
            text={announcement.text || 'Livraison express à Douala & Yaoundé • Retrait gratuit en boutique'}
            themeColor={themeColor}
          />
        )}

        {/* Global Storefront Header */}
        <StoreHeader
          storeSlug={storeSlug}
          storeName={store.store_name}
          logoUrl={store.logo_url}
          themeColor={themeColor}
        />

        {/* Main Store Viewport */}
        <main className="flex-1 w-full">{children}</main>

        {/* Storefront Footer */}
        <FooterSection
          storeName={store.store_name}
          storeSlug={storeSlug}
          themeColor={themeColor}
          settings={
            layout.sections?.find((s: any) => s.type === 'footer')?.settings || {
              copyright: `© ${new Date().getFullYear()} ${store.store_name}. Tous droits réservés.`,
              contactPhone: '',
              contactAddress: 'Cameroun',
            }
          }
        />

        {/* Slide-out Cart Drawer */}
        <CartDrawer storeSlug={storeSlug} themeColor={themeColor} />
      </div>
    </CartProvider>
  );
}
