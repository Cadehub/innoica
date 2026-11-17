// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Signed Guest Order Receipt Helper
// Enables secure SSR rendering of order confirmation for anonymous guests
// under strict store_orders RLS without exposing other customers' orders.
// ====================================================================

import crypto from 'node:crypto';

export interface SignedOrderReceipt {
  storeSlug: string;
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddress: string | null;
  deliveryFeeXaf: number;
  subtotalXaf: number;
  totalAmountXaf: number;
  paymentMethod: 'cash_on_delivery' | 'pickup' | 'manual_mobile_money';
  paymentStatus: string;
  items: Array<{
    id: string;
    product_title: string;
    variant_title: string | null;
    quantity: number;
    unit_price_xaf: number;
    total_price_xaf: number;
  }>;
  issuedAt: number;
}

export const ORDER_RECEIPT_COOKIE_NAME = 'innoica_order_receipt';

const DEV_EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const secret =
    process.env.ORDER_RECEIPT_SECRET ||
    process.env.ENCRYPTION_MASTER_KEY ||
    process.env.WORKER_INTERNAL_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ORDER_RECEIPT_SECRET, ENCRYPTION_MASTER_KEY ou WORKER_INTERNAL_SECRET doit être configuré en production.'
    );
  }

  return DEV_EPHEMERAL_SECRET;
}

export function signOrderReceipt(receipt: SignedOrderReceipt): string {
  const payload = Buffer.from(JSON.stringify(receipt), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOrderReceipt(
  token: string | undefined | null,
  expectedStoreSlug: string,
  expectedOrderNumber: string
): SignedOrderReceipt | null {
  if (!token || !token.includes('.')) return null;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as SignedOrderReceipt;

    if (
      parsed.storeSlug !== expectedStoreSlug ||
      parsed.orderNumber !== expectedOrderNumber
    ) {
      return null;
    }

    if (
      typeof parsed.issuedAt !== 'number' ||
      !Number.isFinite(parsed.issuedAt) ||
      parsed.issuedAt <= 0 ||
      parsed.issuedAt > Date.now() + 60000
    ) {
      return null;
    }

    // Expire receipt token after 2 hours
    if (Date.now() - parsed.issuedAt > 2 * 60 * 60 * 1000) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
