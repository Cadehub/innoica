import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStoreOrderPayloadSchema } from '@innoica/shared';
import {
  ORDER_RECEIPT_COOKIE_NAME,
  signOrderReceipt,
} from '@/lib/order-receipt';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const body = await request.json();

    // Normalize phone whitespace/dashes before Cameroon phone regex validation
    const normalizedPhone =
      typeof body?.customerPhone === 'string'
        ? body.customerPhone.replace(/[\s.-]/g, '').trim()
        : body?.customerPhone;

    const payloadWithSlug = {
      ...body,
      customerPhone: normalizedPhone,
      storeSlug,
    };

    const validation = createStoreOrderPayloadSchema.safeParse(payloadWithSlug);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Données de commande invalides',
          issues: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validation.data;
    const supabase = await createClient();

    // Call atomic Postgres RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'create_store_order',
      {
        p_store_slug: data.storeSlug,
        p_customer_name: data.customerName,
        p_customer_phone: data.customerPhone,
        p_delivery_zone_id: data.deliveryZoneId || null,
        p_delivery_method: data.deliveryMethod,
        p_delivery_address: data.deliveryAddress || null,
        p_payment_method: data.paymentMethod,
        p_items: data.items,
        p_manual_payment_ref: data.manualPaymentRef || null,
        p_manual_payment_phone: data.manualPaymentPhone || null,
        p_delivery_notes: data.deliveryNotes || null,
        p_customer_email: data.customerEmail || null,
        p_cart_token: data.cartToken || null,
        p_metadata: data.metadata || {},
      }
    );

    if (rpcError) {
      return NextResponse.json(
        {
          success: false,
          error: rpcError.message || 'Échec de la validation de la commande',
          code: rpcError.code,
        },
        { status: 400 }
      );
    }

    // Build signed guest order receipt cookie using public product/variant rows
    const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
    const variantIds = Array.from(
      new Set(data.items.map((i) => i.variantId).filter((id): id is string => Boolean(id)))
    );

    const [{ data: prodRows }, { data: varRows }] = await Promise.all([
      supabase.from('products').select('id, title, base_price_xaf').in('id', productIds),
      variantIds.length > 0
        ? supabase.from('product_variants').select('id, title, price_xaf').in('id', variantIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map((prodRows || []).map((p: any) => [p.id, p]));
    const varMap = new Map((varRows || []).map((v: any) => [v.id, v]));

    const receiptItems = data.items.map((it, idx) => {
      const prod = prodMap.get(it.productId);
      const variant = it.variantId ? varMap.get(it.variantId) : null;
      const unitPrice = variant?.price_xaf ?? prod?.base_price_xaf ?? 0;
      return {
        id: `${it.productId}-${it.variantId || idx}`,
        product_title: prod?.title || 'Article commandé',
        variant_title: variant?.title || null,
        quantity: it.quantity,
        unit_price_xaf: unitPrice,
        total_price_xaf: unitPrice * it.quantity,
      };
    });

    const signedToken = signOrderReceipt({
      storeSlug,
      orderNumber: rpcResult.orderNumber,
      orderId: rpcResult.orderId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      deliveryMethod: data.deliveryMethod,
      deliveryAddress: data.deliveryAddress || null,
      deliveryFeeXaf: rpcResult.deliveryFeeXaf ?? 0,
      subtotalXaf: rpcResult.subtotalXaf ?? 0,
      totalAmountXaf: rpcResult.totalXaf ?? 0,
      paymentMethod: data.paymentMethod,
      paymentStatus: rpcResult.paymentStatus || 'pending_verification',
      items: receiptItems,
      issuedAt: Date.now(),
    });

    const res = NextResponse.json(
      {
        success: true,
        order: rpcResult,
      },
      { status: 201 }
    );

    res.cookies.set(ORDER_RECEIPT_COOKIE_NAME, signedToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7200,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Erreur interne du serveur lors de la commande',
      },
      { status: 500 }
    );
  }
}
