import React from 'react';
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductDetailsClient } from './product-details-client';

interface ProductPageProps {
  params: Promise<{ locale: string; storeSlug: string; productSlug: string }>;
}

export async function generateMetadata(
  { params }: ProductPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from('store_settings')
    .select('id, workspace_id, store_name')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    return { title: 'Boutique introuvable — INNOICA' };
  }

  const { data: product } = await supabase
    .from('products')
    .select('title, description, images, base_price_xaf')
    .eq('workspace_id', store.workspace_id)
    .eq('slug', productSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!product) {
    return { title: `Produit introuvable — ${store.store_name}` };
  }

  const title = `${product.title} | ${store.store_name}`;
  const description =
    product.description?.slice(0, 160) ||
    `Commandez ${product.title} sur la boutique ${store.store_name}. Livraison rapide au Cameroun.`;
  const image = product.images?.[0] || '/images/innoica-logo.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, alt: product.title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { storeSlug, productSlug } = await params;
  const supabase = await createClient();

  // 1. Fetch active store
  const { data: store } = await supabase
    .from('store_settings')
    .select('*')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  // 2. Fetch active product
  const { data: productRaw } = await supabase
    .from('products')
    .select(`
      id,
      slug,
      title,
      description,
      base_price_xaf,
      compare_at_price_xaf,
      images,
      sku,
      stock_quantity,
      track_stock,
      has_variants,
      product_categories (name, slug)
    `)
    .eq('workspace_id', store.workspace_id)
    .eq('slug', productSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!productRaw) {
    notFound();
  }

  // 3. Fetch active variants
  const { data: variantsRaw } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productRaw.id)
    .eq('is_active', true)
    .order('price_xaf', { ascending: true });

  const productData = {
    id: productRaw.id,
    title: productRaw.title,
    slug: productRaw.slug,
    description: productRaw.description,
    base_price_xaf: productRaw.base_price_xaf,
    compare_at_price_xaf: productRaw.compare_at_price_xaf,
    images: Array.isArray(productRaw.images) ? productRaw.images : [],
    sku: productRaw.sku,
    stock_quantity: productRaw.stock_quantity ?? 0,
    track_stock: productRaw.track_stock ?? true,
    has_variants: productRaw.has_variants ?? false,
    category_name: (productRaw as any).product_categories?.name || null,
    category_slug: (productRaw as any).product_categories?.slug || null,
    variants: (variantsRaw || []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price_xaf: v.price_xaf,
      stock_quantity: v.stock_quantity ?? 0,
      track_stock: v.track_stock ?? true,
      attributes: v.attributes || {},
      is_active: v.is_active ?? true,
    })),
  };

  return (
    <ProductDetailsClient
      product={productData}
      storeSlug={storeSlug}
      storeName={store.store_name}
      merchantWhatsAppPhone={store.description || ''}
      themeColor={store.theme_color || '#25D366'}
    />
  );
}
