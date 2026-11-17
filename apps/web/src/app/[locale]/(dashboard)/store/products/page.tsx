import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { ProductsClient, type ProductRow } from './products-client';

export default async function StoreProductsPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const { data: products } = await supabase
    .from('products')
    .select('id, title, slug, description, base_price_xaf, stock_quantity, track_stock, is_active, is_featured, images')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false })
    .limit(300);

  return <ProductsClient initialProducts={(products || []) as ProductRow[]} />;
}
