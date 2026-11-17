import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrderConfirmationClient } from './order-confirmation-client';
import {
  ORDER_RECEIPT_COOKIE_NAME,
  verifyOrderReceipt,
} from '@/lib/order-receipt';
import { extractMerchantPhone } from '@/lib/sanitize-builder';

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
    .select('id, workspace_id, store_name, theme_color, description, builder_layout, is_active')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    notFound();
  }

  const merchantPhone = extractMerchantPhone(store.builder_layout, store.description);

  // 2. Try fetching order directly (succeeds when authenticated as workspace merchant)
  const { data: dbOrder } = await supabase
    .from('store_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('workspace_id', store.workspace_id)
    .maybeSingle();

  if (dbOrder) {
    const { data: dbItems } = await supabase
      .from('store_order_items')
      .select('*')
      .eq('order_id', dbOrder.id);

    return (
      <OrderConfirmationClient
        order={dbOrder}
        items={dbItems || []}
        storeSlug={storeSlug}
        storeName={store.store_name}
        themeColor={store.theme_color || '#25D366'}
        merchantPhone={merchantPhone}
      />
    );
  }

  // 3. Fallback for anonymous guest buyers: verify HMAC-signed order receipt cookie
  const cookieStore = await cookies();
  const receiptToken = cookieStore.get(ORDER_RECEIPT_COOKIE_NAME)?.value;
  const receipt = verifyOrderReceipt(receiptToken, storeSlug, orderNumber);

  if (!receipt) {
    notFound();
  }

  const guestOrder = {
    id: receipt.orderId,
    order_number: receipt.orderNumber,
    customer_name: receipt.customerName,
    customer_phone: receipt.customerPhone,
    delivery_method: receipt.deliveryMethod,
    delivery_address: receipt.deliveryAddress,
    delivery_fee_xaf: receipt.deliveryFeeXaf,
    subtotal_xaf: receipt.subtotalXaf,
    total_amount_xaf: receipt.totalAmountXaf,
    payment_method: receipt.paymentMethod,
    payment_status: receipt.paymentStatus,
  };

  return (
    <OrderConfirmationClient
      order={guestOrder}
      items={receipt.items}
      storeSlug={storeSlug}
      storeName={store.store_name}
      themeColor={store.theme_color || '#25D366'}
      merchantPhone={merchantPhone}
    />
  );
}
