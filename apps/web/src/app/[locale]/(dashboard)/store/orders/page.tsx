import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { OrdersClient, type OrderRow } from './orders-client';

export default async function StoreOrdersPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const { data: orders } = await supabase
    .from('store_orders')
    .select(
      'id, order_number, customer_name, customer_phone, delivery_method, delivery_address, delivery_fee_xaf, subtotal_xaf, total_amount_xaf, payment_method, payment_status, manual_payment_ref, order_status, notes, created_at, store_order_items(id, product_title, variant_title, quantity, unit_price_xaf, total_price_xaf)'
    )
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return <OrdersClient initialOrders={(orders || []) as unknown as OrderRow[]} />;
}
