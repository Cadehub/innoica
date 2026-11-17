import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CatalogClient } from './catalog-client';

interface CatalogPageProps {
  params: Promise<{ locale: string; storeSlug: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    inStock?: string;
  }>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { storeSlug } = await params;
  const { q, category, minPrice, maxPrice, sort, inStock } = await searchParams;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from('store_settings')
    .select('id, workspace_id, store_name, theme_color, is_active')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  // Fetch active categories
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, slug, name')
    .eq('workspace_id', store.workspace_id)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  // Fetch active products
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
      is_featured,
      product_categories (name)
    `)
    .eq('workspace_id', store.workspace_id)
    .eq('is_active', true)
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
    category_name: p.product_categories?.name || null,
    is_featured: p.is_featured ?? false,
  }));

  return (
    <CatalogClient
      initialProducts={products}
      categories={categories || []}
      storeSlug={storeSlug}
      themeColor={store.theme_color || '#25D366'}
      initialQuery={q || ''}
      initialCategory={category || 'all'}
      initialMinPrice={minPrice || ''}
      initialMaxPrice={maxPrice || ''}
      initialSort={sort || 'popular'}
      initialInStockOnly={inStock === 'true' || inStock === '1'}
    />
  );
}
