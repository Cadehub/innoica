import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { StoreBuilderClient } from './components/store-builder-client';

interface StoreBuilderPageProps {
  params: Promise<{ locale: string }>;
}

export default async function StoreBuilderPage({ params }: StoreBuilderPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) return null;

  // 1. Fetch store settings
  const { data: store } = await supabase
    .from('store_settings')
    .select('*')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  // 2. Fetch sample active products
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
      product_categories (name)
    `)
    .eq('workspace_id', ctx.workspace.id)
    .eq('is_active', true)
    .limit(8);

  const sampleProducts = (productsRaw || []).map((p: any) => ({
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
  }));

  const initialLayout = store?.builder_layout || {};

  return (
    <StoreBuilderClient
      initialLayout={initialLayout}
      initialThemeColor={store?.theme_color || '#25D366'}
      storeName={store?.store_name || ctx.workspace.name}
      storeSlug={store?.store_slug || ''}
      sampleProducts={sampleProducts}
      locale={locale === 'en' ? 'en' : 'fr'}
    />
  );
}
