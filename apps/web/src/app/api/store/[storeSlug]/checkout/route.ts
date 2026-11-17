import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStoreOrderPayloadSchema } from '@innoica/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const body = await request.json();

    // Ensure storeSlug matches path parameter
    const payloadWithSlug = { ...body, storeSlug };

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

    return NextResponse.json(
      {
        success: true,
        order: rpcResult,
      },
      { status: 201 }
    );
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
