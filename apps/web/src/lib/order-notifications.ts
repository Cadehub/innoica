// ====================================================================
// INNOICA — Merchant WhatsApp notification for new store orders (Milestone 5)
// Best-effort and idempotent: never throws, never blocks the checkout.
// ====================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

const SEND_TIMEOUT_MS = 8000;

export interface MerchantNotifyResult {
  sent: boolean;
  reason?: string;
}

export async function notifyMerchantOfOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<MerchantNotifyResult> {
  try {
    const workerSecret = process.env.WORKER_INTERNAL_SECRET;
    const workerUrl = process.env.WHATSAPP_WORKER_URL;
    if (!workerSecret || !workerUrl || !orderId) {
      return { sent: false, reason: 'not_configured' };
    }

    const { data, error } = await supabase.rpc('worker_get_order_notification', {
      p_order_id: orderId,
      p_worker_secret: workerSecret,
    });
    if (error || !data?.ok) {
      return { sent: false, reason: error?.message || 'rpc_failed' };
    }
    if (!data.send) {
      return { sent: false, reason: data.reason || 'disabled' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${workerUrl}/api/sessions/${data.agentId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toPhone: data.toPhone, text: data.text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { sent: false, reason: `worker_http_${res.status}` };
      }
    } finally {
      clearTimeout(timer);
    }

    await supabase.rpc('worker_mark_order_notified', {
      p_order_id: orderId,
      p_worker_secret: workerSecret,
    });
    return { sent: true };
  } catch (err: any) {
    console.warn('[order-notifications] échec notification marchand:', err?.message);
    return { sent: false, reason: err?.message || 'exception' };
  }
}
