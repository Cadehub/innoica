'use client';

import React from 'react';
import { Monitor, Tablet, Smartphone, Sparkles, ExternalLink } from 'lucide-react';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { HeroSection } from '@/components/storefront/hero-section';
import { FeaturesBannerSection } from '@/components/storefront/features-banner-section';
import { CatalogGridSection } from '@/components/storefront/catalog-grid-section';
import { AboutSection } from '@/components/storefront/about-section';
import { FooterSection } from '@/components/storefront/footer-section';
import { StoreBuilderSection } from '@innoica/shared';
import { ProductCardData } from '@/components/store/product-card';
import { CartProvider } from '@/components/store/cart-context';

// Sample mock products for realistic preview if merchant catalog is empty
const SAMPLE_MOCK_PRODUCTS: ProductCardData[] = [
  {
    id: 'mock-1',
    slug: 'oraimo-freepods-4',
    title: 'Oraimo FreePods 4 Écouteurs Sans Fil ANC',
    base_price_xaf: 18500,
    compare_at_price_xaf: 22000,
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop'],
    stock_quantity: 15,
    track_stock: true,
    category_name: 'Audio & Écouteurs',
  },
  {
    id: 'mock-2',
    slug: 'oraimo-watch-4-plus',
    title: 'Oraimo Watch 4 Plus Montre Connectée Écran HD',
    base_price_xaf: 24500,
    compare_at_price_xaf: 28000,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop'],
    stock_quantity: 8,
    track_stock: true,
    category_name: 'Montres & Wearables',
  },
  {
    id: 'mock-3',
    slug: 'powerbank-toast-10-flash',
    title: 'Batterie Externe PowerBank 10 000 mAh Charge Rapide',
    base_price_xaf: 12000,
    compare_at_price_xaf: 15000,
    images: ['https://images.unsplash.com/photo-1609081219090-a6d8173087ec?w=500&auto=format&fit=crop'],
    stock_quantity: 25,
    track_stock: true,
    category_name: 'Énergie & Câbles',
  },
  {
    id: 'mock-4',
    slug: 'enceinte-bluetooth-boom-pop',
    title: 'Enceinte Bluetooth Waterproof Bass Boost 20W',
    base_price_xaf: 32000,
    compare_at_price_xaf: 36000,
    images: ['https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop'],
    stock_quantity: 4,
    track_stock: true,
    category_name: 'Enceintes Sans Fil',
  },
];

interface DevicePreviewFrameProps {
  themeColor: string;
  sections: StoreBuilderSection[];
  announcement?: { enabled: boolean; text: string };
  storeName: string;
  storeSlug: string;
  sampleProducts?: ProductCardData[];
  viewport: 'desktop' | 'tablet' | 'mobile';
  onChangeViewport: (vp: 'desktop' | 'tablet' | 'mobile') => void;
}

export function DevicePreviewFrame({
  themeColor,
  sections,
  announcement = { enabled: true, text: '' },
  storeName,
  storeSlug,
  sampleProducts = [],
  viewport,
  onChangeViewport,
}: DevicePreviewFrameProps) {
  const productsToRender = sampleProducts.length > 0 ? sampleProducts : SAMPLE_MOCK_PRODUCTS;

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Viewport container width constraints
  const getFrameWidthClass = () => {
    switch (viewport) {
      case 'mobile':
        return 'w-[375px] max-w-full rounded-[40px] border-[8px] border-zinc-900 shadow-2xl';
      case 'tablet':
        return 'w-[768px] max-w-full rounded-[28px] border-[6px] border-zinc-900 shadow-xl';
      case 'desktop':
      default:
        return 'w-full rounded-2xl border border-zinc-200 shadow-sm';
    }
  };

  return (
    <div className="flex flex-col h-full antialiased">
      {/* Top Device Bar */}
      <div className="flex items-center justify-between pb-3 px-1 border-b border-zinc-200">
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onChangeViewport('desktop')}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              viewport === 'desktop'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewport('tablet')}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              viewport === 'tablet'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Tablet className="h-4 w-4" />
            <span className="hidden sm:inline">Tablette (768px)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewport('mobile')}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              viewport === 'mobile'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Mobile (375px)</span>
          </button>
        </div>

        <div className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          <span>Aperçu en direct synchrone</span>
        </div>
      </div>

      {/* Frame Canvas Wrapper */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center bg-zinc-100/70 rounded-2xl mt-3 studio-scroll">
        {sampleProducts.length === 0 && (
          <div className="mb-3 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
            Aperçu avec articles de démonstration — ajoutez vos produits pour afficher votre vrai catalogue.
          </div>
        )}
        <CartProvider storeSlug={storeSlug || 'preview'}>
          <div
            className={`bg-[#fafafb] transition-all duration-300 overflow-hidden min-h-[500px] ${getFrameWidthClass()}`}
            style={{ '--store-theme': themeColor } as React.CSSProperties}
          >
          {/* Mock Announcement */}
          {announcement.enabled !== false && (
            <AnnouncementBar
              enabled={true}
              text={
                announcement.text ||
                'Livraison express à Douala & Yaoundé • Retrait gratuit en boutique'
              }
              themeColor={themeColor}
            />
          )}

          {/* Mock Header */}
          <header className="px-4 py-3 bg-white border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-7 w-7 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-2xs"
                style={{ backgroundColor: themeColor }}
              >
                {storeName.charAt(0)}
              </span>
              <span className="font-black text-sm text-zinc-900 truncate">{storeName}</span>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: themeColor }}
            >
              Panier (0)
            </span>
          </header>

          {/* Render Sections in configured order */}
          <div className="space-y-4 pb-8">
            {sortedSections.map((sec) => {
              if (sec.visible === false) return null;

              switch (sec.type) {
                case 'hero':
                  return (
                    <HeroSection
                      key={sec.id}
                      settings={sec.settings}
                      themeColor={themeColor}
                      storeSlug={storeSlug}
                    />
                  );
                case 'features_banner':
                  return (
                    <FeaturesBannerSection
                      key={sec.id}
                      settings={sec.settings}
                      themeColor={themeColor}
                    />
                  );
                case 'catalog_grid':
                  return (
                    <CatalogGridSection
                      key={sec.id}
                      settings={sec.settings}
                      products={productsToRender}
                      categories={[
                        { id: 'c1', slug: 'audio', name: 'Audio & Écouteurs' },
                        { id: 'c2', slug: 'wearables', name: 'Montres & Wearables' },
                      ]}
                      storeSlug={storeSlug}
                      themeColor={themeColor}
                    />
                  );
                case 'about':
                  return (
                    <AboutSection
                      key={sec.id}
                      settings={sec.settings}
                      themeColor={themeColor}
                    />
                  );
                case 'footer':
                  return (
                    <FooterSection
                      key={sec.id}
                      settings={sec.settings}
                      themeColor={themeColor}
                      storeName={storeName}
                      storeSlug={storeSlug}
                    />
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>
        </CartProvider>
      </div>
    </div>
  );
}
