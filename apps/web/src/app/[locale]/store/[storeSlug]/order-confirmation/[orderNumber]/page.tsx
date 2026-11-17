import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatPriceXaf } from '@/lib/utils';
import {
  CheckCircle2,
  Copy,
  MessageCircle,
  Truck,
  Building,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { OrderConfirmationClient } from './order-confirmation-client';

interface OrderConfirmationPageProps {
  params: Promise<{ locale: string; storeSlug: string; orderNumber: string }>;
}

export async function generateMetadata(
  { params }: OrderConfirmationPageProps
): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Commande ${orderNumber} confirmée — INNOICA Commerce`,
    robots: { index: false, follow: false },
  };
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { storeSlug, orderNumber } = await params;
  const supabase = await createClient();

  // 1. Fetch store
  const { data: store } = await supabase
    .from('store_settings')
    .select('id, workspace_id, store_name, theme_color, description, is_active')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  // 2. Fetch order
  const { data: order } = await supabase
    .from('store_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('workspace_id', store.workspace_id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  // 3. Fetch order items
  const { data: items } = await supabase
    .from('store_order_items')
    .select('*')
    .eq('order_id', order.id);

  return (
    <OrderConfirmationClient
      order={order}
      items={items || []}
      storeSlug={storeSlug}
      storeName={store.store_name}
      themeColor={store.theme_color || '#25D366'}
      merchantPhone={store.description || ''}
    />
  );
}
