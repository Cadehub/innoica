import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';
import { slugRegex, isReservedStoreSlug } from '@innoica/shared';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-builder';

export async function GET() {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);

    const gateResponse = assertCommerceApiAccess(ctx);
    if (gateResponse) return gateResponse;

    const { data: store, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('workspace_id', ctx!.workspace.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, store: store || null });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);

    const gateResponse = assertCommerceApiAccess(ctx);
    if (gateResponse) return gateResponse;

    const body = await request.json();
    const { storeName, storeSlug, description, logoUrl, bannerUrl, currency, isActive } = body;

    const cleanName = sanitizeText(storeName);
    if (!cleanName || cleanName.length < 2) {
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

    const cleanDescription = description ? sanitizeText(description) : null;
    const cleanLogoUrl = logoUrl && String(logoUrl).trim() ? sanitizeUrl(String(logoUrl), '') || null : null;
    const cleanBannerUrl = bannerUrl && String(bannerUrl).trim() ? sanitizeUrl(String(bannerUrl), '') || null : null;

    // Milestone 5 — merchant WhatsApp notification number (optional)
    const hasNotifPhone = Object.prototype.hasOwnProperty.call(body, 'notificationPhone');
    let cleanNotifPhone: string | null = null;
    if (hasNotifPhone && body.notificationPhone) {
      cleanNotifPhone = String(body.notificationPhone).replace(/[\s.()-]/g, '').trim();
      if (!/^\+?[0-9]{8,15}$/.test(cleanNotifPhone)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Numéro de notification invalide (format international, ex: +237690000000)',
          },
          { status: 400 }
        );
      }
    }
    const notifyOnNewOrder =
      typeof body.notifyOnNewOrder === 'boolean' ? body.notifyOnNewOrder : undefined;

    // Upsert store_settings for this workspace
    const { data: updated, error } = await supabase
      .from('store_settings')
      .upsert(
        {
          workspace_id: ctx!.workspace.id,
          store_name: cleanName,
          store_slug: cleanSlug,
          description: cleanDescription,
          logo_url: cleanLogoUrl,
          banner_url: cleanBannerUrl,
          currency: currency || 'XAF',
          is_active: typeof isActive === 'boolean' ? isActive : true,
          ...(hasNotifPhone ? { notification_phone: cleanNotifPhone } : {}),
          ...(notifyOnNewOrder !== undefined ? { notify_on_new_order: notifyOnNewOrder } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      )
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

    revalidatePath(`/fr/store/${cleanSlug}`);
    revalidatePath(`/en/store/${cleanSlug}`);

    return NextResponse.json({ success: true, store: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
