import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CheckoutClient } from './checkout-client';

interface CheckoutPageProps {
  params: Promise<{ locale: string; storeSlug: string }>;
}

export async function generateMetadata(
  { params }: CheckoutPageProps
): Promise<Metadata> {
  const { storeSlug } = await params;
  return {
    title: `Validation de commande | ${storeSlug}`,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { storeSlug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from('store_settings')
    .select('id, workspace_id, store_name, theme_color, description, is_active')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  // Fetch active delivery zones for this workspace
  const { data: zones } = await supabase
    .from('delivery_zones')
    .select('id, name, fee_xaf, estimated_delivery_time, allows_pickup')
    .eq('workspace_id', store.workspace_id)
    .eq('is_active', true)
    .order('fee_xaf', { ascending: true });

  return (
    <CheckoutClient
      storeSlug={storeSlug}
      storeName={store.store_name}
      deliveryZones={zones || []}
      themeColor={store.theme_color || '#25D366'}
      merchantDescription={store.description || ''}
    />
  );
}
