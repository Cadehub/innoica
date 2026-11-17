import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';
import { storeLayoutSchema, hexColorRegex, isReservedStoreSlug } from '@innoica/shared';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-builder';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);

    const gateResponse = assertCommerceApiAccess(ctx);
    if (gateResponse) return gateResponse;

    const body = await request.json();
    const { action = 'publish', layout } = body;

    if (!layout) {
      return NextResponse.json({ success: false, error: 'Layout manquant' }, { status: 400 });
    }

    if (action !== 'draft' && action !== 'publish') {
      return NextResponse.json(
        { success: false, error: 'Action invalide (draft ou publish attendu)' },
        { status: 400 }
      );
    }

    // Validate layout with Zod
    const validation = storeLayoutSchema.safeParse(layout);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration de mise en page invalide',
          issues: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const validatedLayout = validation.data;

    // Validate hex color strictly
    if (!hexColorRegex.test(validatedLayout.themeColor)) {
      return NextResponse.json(
        { success: false, error: 'Code couleur hexadécimal invalide' },
        { status: 400 }
      );
    }

    // Sanitize announcement text
    const sanitizedAnnouncement = {
      enabled: Boolean(validatedLayout.announcement?.enabled ?? true),
      text: sanitizeText(validatedLayout.announcement?.text || ''),
    };

    // Deep sanitize sections to prevent XSS in text and links
    const sanitizedSections = (validatedLayout.sections || []).map((sec: any) => {
      const sanitizedSettings: Record<string, unknown> = {};

      if (sec.settings && typeof sec.settings === 'object') {
        for (const [key, val] of Object.entries(sec.settings)) {
          if (typeof val === 'string') {
            if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
              sanitizedSettings[key] = val.trim() ? sanitizeUrl(val, key.toLowerCase().includes('image') ? '' : '#') : '';
            } else {
              sanitizedSettings[key] = sanitizeText(val);
            }
          } else if (Array.isArray(val)) {
            // E.g. items in features banner
            sanitizedSettings[key] = val.map((item: any) => {
              if (item && typeof item === 'object') {
                const cleanItem: Record<string, unknown> = {};
                for (const [ik, iv] of Object.entries(item)) {
                  cleanItem[ik] = typeof iv === 'string' ? sanitizeText(iv) : iv;
                }
                return cleanItem;
              }
              return item;
            });
          } else {
            sanitizedSettings[key] = val;
          }
        }
      }

      return {
        id: sanitizeText(sec.id) || `sec-${sec.type}`,
        type: sec.type,
        visible: Boolean(sec.visible),
        order: Number(sec.order) || 0,
        settings: sanitizedSettings,
      };
    });

    // Fetch current store_settings to maintain history & draft
    const { data: currentStore } = await supabase
      .from('store_settings')
      .select('id, store_slug, builder_layout, theme_color')
      .eq('workspace_id', ctx!.workspace.id)
      .maybeSingle();

    const existingLayout = (currentStore?.builder_layout as any) || {};
    const existingHistory = Array.isArray(existingLayout.history) ? existingLayout.history : [];

    let updatedBuilderLayout: any;

    if (action === 'draft') {
      // Save draft only (preserve published sections and themeColor)
      updatedBuilderLayout = {
        ...existingLayout,
        themeColor: existingLayout.themeColor || currentStore?.theme_color || '#25D366',
        sections: Array.isArray(existingLayout.sections) ? existingLayout.sections : [],
        draft: {
          themeColor: validatedLayout.themeColor,
          sections: sanitizedSections,
          announcement: sanitizedAnnouncement,
          savedAt: new Date().toISOString(),
        },
      };
    } else {
      // Action: 'publish'
      const hasExistingPublished = Array.isArray(existingLayout.sections) && existingLayout.sections.length > 0;
      const updatedHistory = hasExistingPublished
        ? [
            {
              themeColor: currentStore?.theme_color || existingLayout.themeColor || '#25D366',
              sections: existingLayout.sections,
              announcement: existingLayout.announcement || { enabled: true, text: '' },
              publishedAt: new Date().toISOString(),
              version: (existingHistory[0]?.version || existingHistory.length || 0) + 1,
            },
            ...existingHistory,
          ].slice(0, 5)
        : existingHistory;

      updatedBuilderLayout = {
        themeColor: validatedLayout.themeColor,
        sections: sanitizedSections,
        announcement: sanitizedAnnouncement,
        history: updatedHistory,
        publishedAt: new Date().toISOString(),
      };
    }

    let updated: any;
    let saveError: any;

    if (currentStore) {
      const updatePayload: Record<string, unknown> = {
        builder_layout: updatedBuilderLayout,
        updated_at: new Date().toISOString(),
      };
      if (action === 'publish') {
        updatePayload.theme_color = validatedLayout.themeColor;
      }

      const res = await supabase
        .from('store_settings')
        .update(updatePayload)
        .eq('workspace_id', ctx!.workspace.id)
        .select()
        .single();
      updated = res.data;
      saveError = res.error;
    } else {
      // Auto-provision store_settings if merchant hasn't opened /store yet
      let defaultSlug = (ctx!.workspace.slug || 'boutique')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!defaultSlug || defaultSlug.length < 2 || isReservedStoreSlug(defaultSlug)) {
        defaultSlug = `boutique-${ctx!.workspace.id.slice(0, 8)}`;
      }

      const res = await supabase
        .from('store_settings')
        .insert({
          workspace_id: ctx!.workspace.id,
          store_slug: defaultSlug,
          store_name: ctx!.workspace.name || 'Ma Boutique',
          theme_color: validatedLayout.themeColor,
          builder_layout: updatedBuilderLayout,
          is_active: true,
        })
        .select()
        .single();
      updated = res.data;
      saveError = res.error;
    }

    if (saveError || !updated) {
      return NextResponse.json(
        { success: false, error: saveError?.message || 'Échec de sauvegarde' },
        { status: 400 }
      );
    }

    if (action === 'publish' && updated.store_slug) {
      revalidatePath(`/fr/store/${updated.store_slug}`);
      revalidatePath(`/en/store/${updated.store_slug}`);
    }

    return NextResponse.json({
      success: true,
      action,
      builderLayout: updated.builder_layout,
      themeColor: updated.theme_color,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
