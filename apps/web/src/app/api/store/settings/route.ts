import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';
import { slugRegex, isReservedStoreSlug } from '@innoica/shared';

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);

    const gateResponse = assertCommerceApiAccess(ctx);
    if (gateResponse) return gateResponse;

    const body = await request.json();
    const { storeName, storeSlug, description, currency, isActive } = body;

    if (!storeName || storeName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Le nom de la boutique doit comporter au moins 2 caractères' },
        { status: 400 }
      );
    }

    const cleanSlug = (storeSlug || '').trim().toLowerCase();
    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Le slug de la boutique doit comporter au moins 2 caractères' },
        { status: 400 }
      );
    }

    if (!slugRegex.test(cleanSlug)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le lien ne doit comporter que des lettres minuscules, chiffres et tirets',
        },
        { status: 400 }
      );
    }

    if (isReservedStoreSlug(cleanSlug)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ce nom de boutique est réservé par la plateforme INNOICA.',
        },
        { status: 400 }
      );
    }

    // Update store_settings for this workspace
    const { data: updated, error } = await supabase
      .from('store_settings')
      .update({
        store_name: storeName.trim(),
        store_slug: cleanSlug,
        description: description ? description.trim() : null,
        currency: currency || 'XAF',
        is_active: typeof isActive === 'boolean' ? isActive : true,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx!.workspace.id)
      .select()
      .single();

    if (error) {
      // Postgres unique violation code 23505
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: 'Ce lien de boutique est déjà réservé par un autre commerçant. Veuillez en choisir un autre.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, store: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
