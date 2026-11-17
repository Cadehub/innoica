import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createCartSupabaseClient(cartToken?: string | null) {
  const headers: Record<string, string> = {};
  if (cartToken && uuidRegex.test(cartToken)) {
    headers['x-cart-token'] = cartToken;
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

const cartMutationSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(0).max(999),
  cartToken: z.string().uuid().optional(),
});

async function resolveActiveStore(supabase: any, storeSlug: string) {
  const { data: store } = await supabase
    .from('store_settings')
    .select('id, workspace_id')
    .eq('store_slug', storeSlug)
    .eq('is_active', true)
    .maybeSingle();
  return store;
}

async function fetchFormattedCartItems(supabase: any, cartId: string) {
  const { data: items } = await supabase
    .from('store_cart_items')
    .select(`
      id,
      quantity,
      unit_price_snapshot_xaf,
      product_id,
      variant_id,
      products (title, images, stock_quantity, track_stock, base_price_xaf),
      product_variants (title, price_xaf, stock_quantity)
    `)
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });

  return (items || []).map((it: any) => ({
    id: it.id,
    productId: it.product_id,
    variantId: it.variant_id,
    quantity: it.quantity,
    priceXaf:
      it.product_variants?.price_xaf ??
      it.products?.base_price_xaf ??
      it.unit_price_snapshot_xaf,
    title: it.products?.title || 'Produit',
    variantTitle: it.product_variants?.title || null,
    image: it.products?.images?.[0] || null,
    stockQuantity:
      it.product_variants?.stock_quantity ?? it.products?.stock_quantity ?? 0,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const { searchParams } = new URL(request.url);
    const cartToken =
      searchParams.get('cartToken') ||
      request.cookies.get(`innoica_cart_${storeSlug}`)?.value ||
      request.headers.get('x-cart-token');

    if (!cartToken || !uuidRegex.test(cartToken)) {
      return NextResponse.json({ success: true, items: [] });
    }

    const supabase = createCartSupabaseClient(cartToken);
    const store = await resolveActiveStore(supabase, storeSlug);
    if (!store) {
      return NextResponse.json({ success: false, error: 'Boutique introuvable' }, { status: 404 });
    }

    const { data: cart } = await supabase
      .from('store_carts')
      .select('id')
      .eq('cart_token', cartToken)
      .eq('workspace_id', store.workspace_id)
      .maybeSingle();

    if (!cart) {
      return NextResponse.json({ success: true, items: [] });
    }

    const items = await fetchFormattedCartItems(supabase, cart.id);
    return NextResponse.json({ success: true, cartToken, items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const body = await request.json();
    const parsed = cartMutationSchema.safeParse(body);
    if (!parsed.success || parsed.data.quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Article ou quantité invalide' },
        { status: 400 }
      );
    }

    const { productId, variantId = null, quantity } = parsed.data;
    const rawToken =
      parsed.data.cartToken ||
      request.cookies.get(`innoica_cart_${storeSlug}`)?.value ||
      request.headers.get('x-cart-token');

    const cartToken = rawToken && uuidRegex.test(rawToken) ? rawToken : crypto.randomUUID();
    const supabase = createCartSupabaseClient(cartToken);

    const store = await resolveActiveStore(supabase, storeSlug);
    if (!store) {
      return NextResponse.json({ success: false, error: 'Boutique introuvable' }, { status: 404 });
    }

    // Verify product and authoritative price
    const { data: product } = await supabase
      .from('products')
      .select('id, base_price_xaf, stock_quantity, track_stock, is_active')
      .eq('id', productId)
      .eq('workspace_id', store.workspace_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!product) {
      return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 });
    }

    let unitPrice = product.base_price_xaf;
    let availableStock = product.stock_quantity;
    let trackStock = product.track_stock;

    if (variantId) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('id, price_xaf, stock_quantity, track_stock, is_active')
        .eq('id', variantId)
        .eq('product_id', productId)
        .eq('workspace_id', store.workspace_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!variant) {
        return NextResponse.json({ success: false, error: 'Variante introuvable' }, { status: 404 });
      }
      unitPrice = variant.price_xaf;
      availableStock = variant.stock_quantity;
      trackStock = variant.track_stock;
    }

    const { data: cartRpc, error: cartErr } = await supabase.rpc('get_or_create_store_cart', {
      p_workspace_id: store.workspace_id,
      p_cart_token: cartToken,
    });

    if (cartErr || !cartRpc?.id) {
      return NextResponse.json(
        { success: false, error: cartErr?.message || 'Impossible de créer le panier' },
        { status: 400 }
      );
    }

    const cartId = cartRpc.id;

    // Check existing item in cart
    let existingQuery = supabase
      .from('store_cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', productId);

    existingQuery = variantId
      ? existingQuery.eq('variant_id', variantId)
      : existingQuery.is('variant_id', null);

    const { data: existingItem } = await existingQuery.maybeSingle();

    const nextQty = (existingItem?.quantity || 0) + quantity;
    if (trackStock && availableStock >= 0 && nextQty > availableStock) {
      return NextResponse.json(
        { success: false, error: 'Stock insuffisant pour la quantité demandée' },
        { status: 400 }
      );
    }

    if (existingItem) {
      await supabase
        .from('store_cart_items')
        .update({
          quantity: nextQty,
          unit_price_snapshot_xaf: unitPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id);
    } else {
      await supabase.from('store_cart_items').insert({
        cart_id: cartId,
        workspace_id: store.workspace_id,
        product_id: productId,
        variant_id: variantId,
        quantity: nextQty,
        unit_price_snapshot_xaf: unitPrice,
      });
    }

    const items = await fetchFormattedCartItems(supabase, cartId);
    const res = NextResponse.json({ success: true, cartToken, items });
    res.cookies.set(`innoica_cart_${storeSlug}`, cartToken, {
      path: '/',
      maxAge: 2592000,
      sameSite: 'lax',
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const body = await request.json();
    const parsed = cartMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
    }

    const { productId, variantId = null, quantity } = parsed.data;
    const cartToken =
      parsed.data.cartToken ||
      request.cookies.get(`innoica_cart_${storeSlug}`)?.value ||
      request.headers.get('x-cart-token');

    if (!cartToken || !uuidRegex.test(cartToken)) {
      return NextResponse.json({ success: false, error: 'Panier introuvable' }, { status: 404 });
    }

    const supabase = createCartSupabaseClient(cartToken);
    const store = await resolveActiveStore(supabase, storeSlug);
    if (!store) {
      return NextResponse.json({ success: false, error: 'Boutique introuvable' }, { status: 404 });
    }

    const { data: cart } = await supabase
      .from('store_carts')
      .select('id')
      .eq('cart_token', cartToken)
      .eq('workspace_id', store.workspace_id)
      .maybeSingle();

    if (!cart) {
      return NextResponse.json({ success: true, items: [] });
    }

    let matchQuery = supabase
      .from('store_cart_items')
      .select('id')
      .eq('cart_id', cart.id)
      .eq('product_id', productId);

    matchQuery = variantId
      ? matchQuery.eq('variant_id', variantId)
      : matchQuery.is('variant_id', null);

    const { data: existingItem } = await matchQuery.maybeSingle();

    if (existingItem) {
      if (quantity <= 0) {
        await supabase.from('store_cart_items').delete().eq('id', existingItem.id);
      } else {
        await supabase
          .from('store_cart_items')
          .update({ quantity, updated_at: new Date().toISOString() })
          .eq('id', existingItem.id);
      }
    }

    const items = await fetchFormattedCartItems(supabase, cart.id);
    return NextResponse.json({ success: true, cartToken, items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> }
) {
  try {
    const { storeSlug } = await params;
    const { searchParams } = new URL(request.url);
    const cartToken =
      searchParams.get('cartToken') ||
      request.cookies.get(`innoica_cart_${storeSlug}`)?.value ||
      request.headers.get('x-cart-token');

    if (!cartToken || !uuidRegex.test(cartToken)) {
      return NextResponse.json({ success: true, items: [] });
    }

    const supabase = createCartSupabaseClient(cartToken);
    const store = await resolveActiveStore(supabase, storeSlug);
    if (!store) {
      return NextResponse.json({ success: false, error: 'Boutique introuvable' }, { status: 404 });
    }

    const { data: cart } = await supabase
      .from('store_carts')
      .select('id')
      .eq('cart_token', cartToken)
      .eq('workspace_id', store.workspace_id)
      .maybeSingle();

    if (!cart) {
      return NextResponse.json({ success: true, items: [] });
    }

    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');

    if (productId && uuidRegex.test(productId)) {
      let delQuery = supabase
        .from('store_cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', productId);

      delQuery =
        variantId && uuidRegex.test(variantId)
          ? delQuery.eq('variant_id', variantId)
          : delQuery.is('variant_id', null);

      await delQuery;
    } else {
      await supabase.from('store_cart_items').delete().eq('cart_id', cart.id);
    }

    const items = await fetchFormattedCartItems(supabase, cart.id);
    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
