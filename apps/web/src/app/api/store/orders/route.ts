import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';

const patchSchema = z
  .object({
    orderId: z.string().uuid(),
    orderStatus: z
      .enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
      .optional(),
    paymentStatus: z.enum(['pending_verification', 'paid', 'failed', 'refunded']).optional(),
  })
  .refine((v) => v.orderStatus || v.paymentStatus, { message: 'Aucun changement fourni' });

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Corps JSON invalide' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    // The RPC re-checks merchant membership on the order's workspace (defense in depth)
    const { data, error } = await supabase.rpc('update_store_order_status', {
      p_order_id: parsed.data.orderId,
      p_order_status: parsed.data.orderStatus ?? null,
      p_payment_status: parsed.data.paymentStatus ?? null,
      p_notes: null,
    });

    if (error) {
      const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400;
      return NextResponse.json({ success: false, error: error.message }, { status });
    }

    return NextResponse.json({
      success: true,
      orderStatus: data?.orderStatus,
      paymentStatus: data?.paymentStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
