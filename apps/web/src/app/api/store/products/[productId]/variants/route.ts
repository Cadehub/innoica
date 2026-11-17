import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';
import { sanitizeText } from '@/lib/sanitize-builder';

const MAX_PRICE_XAF = 100_000_000;
const MAX_STOCK = 1_000_000;

const createVariantSchema = z.object({
  title: z.string().trim().min(1).max(100),
  priceXaf: z.number().int().min(0).max(MAX_PRICE_XAF),
  stockQuantity: z.number().int().min(0).max(MAX_STOCK).default(0),
  sku: z.string().trim().max(100).optional().nullable(),
});

const updateVariantSchema = z.object({
  variantId: z.string().uuid(),
  title: z.string().trim().min(1).max(100).optional(),
  priceXaf: z.number().int().min(0).max(MAX_PRICE_XAF).optional(),
  stockQuantity: z.number().int().min(0).max(MAX_STOCK).optional(),
  sku: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
});

const deleteVariantSchema = z.object({
  variantId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    const { data: variants, error } = await supabase
      .from('product_variants')
      .select('id, product_id, title, sku, price_xaf, stock_quantity, track_stock, is_active, created_at')
      .eq('product_id', productId)
      .eq('workspace_id', ctx!.workspace.id)
      .order('price_xaf', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, variants: variants || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    const body = await request.json().catch(() => null);
    const parsed = createVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Données variante invalides', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { title, priceXaf, stockQuantity, sku } = parsed.data;

    // Verify product exists and belongs to workspace
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, workspace_id')
      .eq('id', productId)
      .eq('workspace_id', ctx!.workspace.id)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 });
    }

    // Insert variant
    const { data: variant, error: varErr } = await supabase
      .from('product_variants')
      .insert({
        workspace_id: ctx!.workspace.id,
        product_id: productId,
        title: sanitizeText(title),
        price_xaf: priceXaf,
        stock_quantity: stockQuantity,
        sku: sku ? sanitizeText(sku) : null,
        track_stock: true,
        is_active: true,
      })
      .select('*')
      .single();

    if (varErr) {
      return NextResponse.json({ success: false, error: varErr.message }, { status: 400 });
    }

    // Ensure parent product has_variants = true
    await supabase
      .from('products')
      .update({ has_variants: true, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('workspace_id', ctx!.workspace.id);

    return NextResponse.json({ success: true, variant }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    const body = await request.json().catch(() => null);
    const parsed = updateVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Données variante invalides', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { variantId, title, priceXaf, stockQuantity, sku, isActive } = parsed.data;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = sanitizeText(title);
    if (priceXaf !== undefined) patch.price_xaf = priceXaf;
    if (stockQuantity !== undefined) patch.stock_quantity = stockQuantity;
    if (sku !== undefined) patch.sku = sku ? sanitizeText(sku) : null;
    if (isActive !== undefined) patch.is_active = isActive;

    const { data: updated, error } = await supabase
      .from('product_variants')
      .update(patch)
      .eq('id', variantId)
      .eq('product_id', productId)
      .eq('workspace_id', ctx!.workspace.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, variant: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    const body = await request.json().catch(() => null);
    const parsed = deleteVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'ID de variante manquant' }, { status: 400 });
    }

    const { error: delErr } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', parsed.data.variantId)
      .eq('product_id', productId)
      .eq('workspace_id', ctx!.workspace.id);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 400 });
    }

    // Check remaining variants count
    const { count } = await supabase
      .from('product_variants')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('workspace_id', ctx!.workspace.id);

    if (count === 0) {
      await supabase
        .from('products')
        .update({ has_variants: false, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('workspace_id', ctx!.workspace.id);
    }

    return NextResponse.json({ success: true, remainingCount: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
