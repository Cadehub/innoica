import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { StoreOverviewClient } from './store-overview-client';

interface StoreOverviewPageProps {
  params: Promise<{ locale: string }>;
}

export default async function StoreOverviewPage({ params }: StoreOverviewPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) return null;

  // 1. Fetch or create default store_settings for this workspace if missing
  let { data: store } = await supabase
    .from('store_settings')
    .select('*')
    .eq('workspace_id', ctx.workspace.id)
    .maybeSingle();

  if (!store) {
    // Generate clean unique initial slug based on workspace slug or name
    const initialSlug = (ctx.workspace.slug || 'boutique')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data: createdStore } = await supabase
      .from('store_settings')
      .insert({
        workspace_id: ctx.workspace.id,
        store_slug: initialSlug || `store-${ctx.workspace.id.slice(0, 8)}`,
        store_name: ctx.workspace.name || 'Ma Boutique',
        theme_color: '#25D366',
        is_active: true,
      })
      .select()
      .single();

    store = createdStore;
  }

  // 2. Fetch counts
  const [{ count: productsCount }, { count: categoriesCount }, { count: ordersCount }] =
    await Promise.all([
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspace.id)
        .eq('is_active', true),
      supabase
        .from('product_categories')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspace.id)
        .eq('is_active', true),
      supabase
        .from('store_orders')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ctx.workspace.id),
    ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const publicStoreUrl = `${appUrl}/store/${store?.store_slug || ''}`;

  return (
    <StoreOverviewClient
      storeSlug={store?.store_slug || ''}
      storeName={store?.store_name || ctx.workspace.name}
      isActive={store?.is_active ?? true}
      themeColor={store?.theme_color || '#25D366'}
      currency={store?.currency || 'XAF'}
      productsCount={productsCount ?? 0}
      categoriesCount={categoriesCount ?? 0}
      ordersCount={ordersCount ?? 0}
      publicStoreUrl={publicStoreUrl}
      locale={locale === 'en' ? 'en' : 'fr'}
    />
  );
}
