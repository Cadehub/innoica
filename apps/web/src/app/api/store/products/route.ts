import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-builder';

const MAX_PRICE_XAF = 100_000_000;
const MAX_STOCK = 1_000_000;

const variantItemSchema = z.object({
  title: z.string().trim().min(1).max(100),
  priceXaf: z.number().int().min(0).max(MAX_PRICE_XAF),
  stockQuantity: z.number().int().min(0).max(MAX_STOCK).default(0),
  sku: z.string().trim().max(100).optional().nullable(),
});

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  basePriceXaf: z.number().int().min(0).max(MAX_PRICE_XAF),
  stockQuantity: z.number().int().min(0).max(MAX_STOCK).default(0),
  trackStock: z.boolean().default(true),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  isFeatured: z.boolean().optional(),
  variants: z.array(variantItemSchema).optional(),
});

const updateSchema = z
  .object({
    productId: z.string().uuid(),
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    basePriceXaf: z.number().int().min(0).max(MAX_PRICE_XAF).optional(),
    stockQuantity: z.number().int().min(0).max(MAX_STOCK).optional(),
    trackStock: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 1, { message: 'Aucun changement fourni' });

function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'produit';
}

async function readJson(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    const body = await readJson(request);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Données produit invalides', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const title = sanitizeText(d.title);
    if (title.length < 2) {
      return NextResponse.json({ success: false, error: 'Titre invalide' }, { status: 400 });
    }
    const image = d.imageUrl && d.imageUrl.trim() ? sanitizeUrl(d.imageUrl, '') : '';
    if (d.imageUrl && d.imageUrl.trim() && !image) {
      return NextResponse.json({ success: false, error: "URL d'image invalide (HTTPS requis)" }, { status: 400 });
    }

    const hasVariants = Array.isArray(d.variants) && d.variants.length > 0;
    const baseSlug = slugify(title);
    for (let attempt = 0; attempt < 4; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .from('products')
        .insert({
          workspace_id: ctx!.workspace.id,
          title,
          slug,
          description: d.description ? sanitizeText(d.description) : null,
          base_price_xaf: d.basePriceXaf,
          stock_quantity: d.stockQuantity,
          track_stock: d.trackStock,
          has_variants: hasVariants,
          images: image ? [image] : [],
          is_featured: d.isFeatured ?? false,
          is_active: true,
        })
        .select('id, title, slug, description, base_price_xaf, stock_quantity, track_stock, has_variants, is_active, is_featured, images')
        .single();

      if (!error && data) {
        if (hasVariants && d.variants) {
          const varRows = d.variants.map((v) => ({
            workspace_id: ctx!.workspace.id,
            product_id: data.id,
            title: sanitizeText(v.title),
            price_xaf: v.priceXaf,
            stock_quantity: v.stockQuantity,
            sku: v.sku ? sanitizeText(v.sku) : null,
            track_stock: true,
            is_active: true,
          }));
          await supabase.from('product_variants').insert(varRows);
        }
        return NextResponse.json({ success: true, product: data }, { status: 201 });
      }
      if (error && error.code !== '23505') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json({ success: false, error: 'Impossible de générer un lien unique' }, { status: 409 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    const gate = assertCommerceApiAccess(ctx);
    if (gate) return gate;

    const body = await readJson(request);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }
    const d = parsed.data;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (d.title !== undefined) patch.title = sanitizeText(d.title);
    if (d.description !== undefined) patch.description = d.description ? sanitizeText(d.description) : null;
    if (d.basePriceXaf !== undefined) patch.base_price_xaf = d.basePriceXaf;
    if (d.stockQuantity !== undefined) patch.stock_quantity = d.stockQuantity;
    if (d.trackStock !== undefined) patch.track_stock = d.trackStock;
    if (d.isActive !== undefined) patch.is_active = d.isActive;
    if (d.isFeatured !== undefined) patch.is_featured = d.isFeatured;

    // Scoped to the caller's workspace on top of RLS
    const { data, error } = await supabase
      .from('products')
      .update(patch)
      .eq('id', d.productId)
      .eq('workspace_id', ctx!.workspace.id)
      .select('id, title, slug, description, base_price_xaf, stock_quantity, track_stock, is_active, is_featured, images')
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ success: false, error: 'Produit introuvable' }, { status: 404 });
    return NextResponse.json({ success: true, product: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
