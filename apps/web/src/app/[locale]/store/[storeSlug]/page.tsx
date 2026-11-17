import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HeroSection } from '@/components/storefront/hero-section';
import { FeaturesBannerSection } from '@/components/storefront/features-banner-section';
import { CatalogGridSection } from '@/components/storefront/catalog-grid-section';
import { AboutSection } from '@/components/storefront/about-section';
import { ProductCard } from '@/components/store/product-card';
import { Zap, Sparkles } from 'lucide-react';

interface StoreHomePageProps {
  params: Promise<{ locale: string; storeSlug: string }>;
}

export default async function StoreHomePage({ params }: StoreHomePageProps) {
  const { storeSlug } = await params;
  const supabase = await createClient();

  // Fetch store settings
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

  // Fetch categories
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, slug, name')
    .eq('workspace_id', store.workspace_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  // Fetch active products with category
  const { data: productsRaw } = await supabase
    .from('products')
    .select(`
      id,
      slug,
      title,
      base_price_xaf,
      compare_at_price_xaf,
      images,
      stock_quantity,
      track_stock,
      has_variants,
      is_featured,
      category_id,
      product_categories (name)
    `)
    .eq('workspace_id', store.workspace_id)
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  const products = (productsRaw || []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    base_price_xaf: p.base_price_xaf,
    compare_at_price_xaf: p.compare_at_price_xaf,
    images: Array.isArray(p.images) ? p.images : [],
    stock_quantity: p.stock_quantity ?? 0,
    track_stock: p.track_stock ?? true,
    has_variants: p.has_variants ?? false,
    category_name: p.product_categories?.name || null,
    is_featured: p.is_featured ?? false,
  }));

  // Flash deals: items where compare_at_price_xaf > base_price_xaf
  const flashDeals = products.filter(
    (p) => p.compare_at_price_xaf && p.compare_at_price_xaf > p.base_price_xaf
  );

  const builderLayout = store.builder_layout || {};
  const sections: any[] = Array.isArray(builderLayout.sections) ? builderLayout.sections : [];
  const sortedSections = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // If merchant has defined custom sections in the builder, render them dynamically
  const hasCustomSections = sortedSections.length > 0;

  return (
    <div className="pb-12 space-y-6">
      {hasCustomSections ? (
        sortedSections.map((sec) => {
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
                  products={products}
                  categories={categories || []}
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
            default:
              return null;
          }
        })
      ) : (
        /* Default Oraimo-style Layout */
        <>
          <HeroSection
            settings={{
              title: store.store_name,
              subtitle: store.description || 'Découvrez nos articles au meilleur prix au Cameroun.',
              badgeText: 'Boutique Officielle',
              ctaText: 'Commander maintenant',
              ctaLink: '#catalog',
              imageUrl: store.banner_url || store.logo_url || '',
            }}
            themeColor={themeColor}
            storeSlug={storeSlug}
          />

          <FeaturesBannerSection themeColor={themeColor} />

          {/* Flash Deals Section (Oraimo Cameroun Inspiration) */}
          {flashDeals.length > 0 && (
            <section className="px-3 sm:px-4 md:px-6 my-8 max-w-7xl mx-auto">
              <div className="p-4 sm:p-6 rounded-2xl md:rounded-3xl bg-zinc-900 text-white shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-600 text-white animate-pulse">
                      <Zap className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                        <span>Ventes Flash & Promotions</span>
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Offres à durée limitée jusqu'à épuisement du stock
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {flashDeals.slice(0, 4).map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      storeSlug={storeSlug}
                      themeColor={themeColor}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <CatalogGridSection
            products={products}
            categories={categories || []}
            storeSlug={storeSlug}
            themeColor={themeColor}
          />

          <AboutSection
            settings={{
              title: `À propos de ${store.store_name}`,
              body: store.description || undefined,
              locationText: 'Douala & Yaoundé, Cameroun',
            }}
            themeColor={themeColor}
          />
        </>
      )}
    </div>
  );
}
