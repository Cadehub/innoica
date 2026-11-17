import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertCommerceApiAccess } from '@/lib/feature-gating';
import { storeLayoutSchema, hexColorRegex } from '@innoica/shared';
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

    // Deep sanitize sections to prevent XSS in text and links
    const sanitizedSections = (validatedLayout.sections || []).map((sec: any) => {
      const sanitizedSettings: Record<string, unknown> = {};

      if (sec.settings && typeof sec.settings === 'object') {
        for (const [key, val] of Object.entries(sec.settings)) {
          if (typeof val === 'string') {
            if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
              sanitizedSettings[key] = sanitizeUrl(val);
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
        id: sec.id,
        type: sec.type,
        visible: Boolean(sec.visible),
        order: Number(sec.order) || 0,
        settings: sanitizedSettings,
      };
    });

    // Fetch current store_settings to maintain history & draft
    const { data: currentStore } = await supabase
      .from('store_settings')
      .select('id, builder_layout, theme_color')
      .eq('workspace_id', ctx!.workspace.id)
      .single();

    const existingLayout = (currentStore?.builder_layout as any) || {};
    const existingHistory = Array.isArray(existingLayout.history) ? existingLayout.history : [];

    let updatedBuilderLayout: any;

    if (action === 'draft') {
      // Save draft only
      updatedBuilderLayout = {
        ...existingLayout,
        draft: {
          themeColor: validatedLayout.themeColor,
          sections: sanitizedSections,
          announcement: validatedLayout.announcement || { enabled: true, text: '' },
          savedAt: new Date().toISOString(),
        },
      };
    } else {
      // Action: 'publish'
      // 1. Snapshot previous layout into history (capped at 5 snapshots)
      const previousSnapshot = {
        themeColor: currentStore?.theme_color || existingLayout.themeColor || '#25D366',
        sections: existingLayout.sections || [],
        announcement: existingLayout.announcement || { enabled: true, text: '' },
        publishedAt: new Date().toISOString(),
        version: (existingHistory.length || 0) + 1,
      };

      const updatedHistory = [previousSnapshot, ...existingHistory].slice(0, 5);

      updatedBuilderLayout = {
        themeColor: validatedLayout.themeColor,
        sections: sanitizedSections,
        announcement: validatedLayout.announcement || { enabled: true, text: '' },
        history: updatedHistory,
        publishedAt: new Date().toISOString(),
      };
    }

    const { data: updated, error } = await supabase
      .from('store_settings')
      .update({
        theme_color: validatedLayout.themeColor,
        builder_layout: updatedBuilderLayout,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx!.workspace.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
