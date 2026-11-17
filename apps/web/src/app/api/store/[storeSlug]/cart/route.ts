import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const { searchParams } = new URL(request.url);
    const cartToken = searchParams.get('cartToken') || request.cookies.get(`innoica_cart_${storeSlug}`)?.value;

    if (!cartToken) {
      return NextResponse.json({ success: true, items: [] });
    }

    const supabase = await createClient();

    // Find store
    const { data: store } = await supabase
      .from('store_settings')
      .select('id, workspace_id')
      .eq('store_slug', storeSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ success: false, error: 'Boutique introuvable' }, { status: 404 });
    }

    // Find active cart
    const { data: cart } = await supabase
      .from('store_carts')
      .select('id')
      .eq('cart_token', cartToken)
      .eq('workspace_id', store.workspace_id)
      .maybeSingle();

    if (!cart) {
      return NextResponse.json({ success: true, items: [] });
    }

    const { data: items } = await supabase
      .from('store_cart_items')
      .select(`
        id,
        quantity,
        unit_price_snapshot_xaf,
        product_id,
        variant_id,
        products (title, images, stock_quantity, track_stock),
        product_variants (title, price_xaf, stock_quantity)
      `)
      .eq('cart_id', cart.id);

    return NextResponse.json({
      success: true,
      items: (items || []).map((it: any) => ({
        id: it.id,
        productId: it.product_id,
        variantId: it.variant_id,
        quantity: it.quantity,
        priceXaf: it.product_variants?.price_xaf || it.unit_price_snapshot_xaf,
        title: it.products?.title || 'Produit',
        variantTitle: it.product_variants?.title || null,
        image: it.products?.images?.[0] || null,
        stockQuantity: it.product_variants?.stock_quantity ?? it.products?.stock_quantity ?? 0,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
