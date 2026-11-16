import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminPaymentDecisionSchema, adminPlanConfigSchema } from '@innoica/shared';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

const setWorkspacePlanSchema = z.object({
  action: z.literal('set_workspace_plan'),
  workspaceId: z.string().uuid(),
  planSlug: z.enum(['free', 'starter']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  durationDays: z.number().int().min(1).max(3660).default(30),
});

const toggleWorkspaceStatusSchema = z.object({
  action: z.literal('toggle_workspace_status'),
  workspaceId: z.string().uuid(),
  status: z.enum(['active', 'suspended']),
});

const toggleAgentStatusSchema = z.object({
  action: z.literal('toggle_agent_status'),
  agentId: z.string().uuid(),
  status: z.enum(['active', 'paused']),
});

const updatePlatformSettingsSchema = z.object({
  action: z.literal('update_platform_settings'),
  officialUrl: z.string().url(),
  freeWatermarkFr: z.string().trim().min(5).max(300),
  freeWatermarkEn: z.string().trim().min(5).max(300),
});

async function requireSuperAdmin() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx || !ctx.profile.is_super_admin) {
    return { supabase, ctx: null };
  }
  return { supabase, ctx };
}

export async function GET() {
  const { supabase, ctx } = await requireSuperAdmin();
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Accès Super Admin requis' }, { status: 403 });
  }

  const [plansRes, declarationsRes, workspacesRes, agentsRes, settingsRes, logsRes, voiceJobsRes] =
    await Promise.all([
      supabase.from('plans').select('*').in('slug', ['free', 'starter']).order('sort_order'),
      supabase
        .from('payment_declarations')
        .select('*, workspaces(name, slug), plans(slug, name_fr)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('workspaces')
        .select('id, name, slug, status, plan_id, created_at, plans(slug, name_fr)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('agents')
        .select('id, name, workspace_id, status, ai_provider, ai_model, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('platform_settings').select('*').eq('id', 'default').maybeSingle(),
      supabase
        .from('execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('voice_processing_jobs')
        .select('id, workspace_id, status, detected_language, quality_category, comprehension_status, duration_seconds, processing_ms, error_code, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

  return NextResponse.json({
    success: true,
    plans: plansRes.data || [],
    declarations: declarationsRes.data || [],
    workspaces: workspacesRes.data || [],
    agents: agentsRes.data || [],
    platformSettings: settingsRes.data || null,
    logs: logsRes.data || [],
    voiceJobs: voiceJobsRes.data || [],
  });
}

export async function POST(request: Request) {
  const { supabase, ctx } = await requireSuperAdmin();
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Accès Super Admin requis' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (body?.action === 'review_payment') {
      const parsed = adminPaymentDecisionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('review_payment_declaration', {
        p_declaration_id: parsed.data.declarationId,
        p_decision: parsed.data.decision,
        p_review_note: parsed.data.reviewNote || null,
      });
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, result: data });
    }

    if (body?.action === 'update_plan') {
      const parsed = adminPlanConfigSchema.safeParse(body.plan || body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Configuration plan invalide', details: parsed.error.format() },
          { status: 400 }
        );
      }

      const { slug, ...fields } = parsed.data;
      const { data, error } = await supabase
        .from('plans')
        .update({
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq('slug', slug)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, plan: data });
    }

    if (body?.action === 'set_workspace_plan') {
      const parsed = setWorkspacePlanSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_set_workspace_plan', {
        p_workspace_id: parsed.data.workspaceId,
        p_plan_slug: parsed.data.planSlug,
        p_billing_cycle: parsed.data.billingCycle,
        p_duration_days: parsed.data.durationDays,
      });
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, result: data });
    }

    if (body?.action === 'toggle_workspace_status') {
      const parsed = toggleWorkspaceStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('workspaces')
        .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
        .eq('id', parsed.data.workspaceId)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, workspace: data });
    }

    if (body?.action === 'toggle_agent_status') {
      const parsed = toggleAgentStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('agents')
        .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
        .eq('id', parsed.data.agentId)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, agent: data });
    }

    if (body?.action === 'update_platform_settings') {
      const parsed = updatePlatformSettingsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Paramètres plateforme invalides' }, { status: 400 });
      }

      const { data: current } = await supabase
        .from('platform_settings')
        .select('platform_identity')
        .eq('id', 'default')
        .maybeSingle();

      const nextIdentity = {
        ...(current?.platform_identity || {}),
        official_url: parsed.data.officialUrl,
        free_watermark_fr: parsed.data.freeWatermarkFr,
        free_watermark_en: parsed.data.freeWatermarkEn,
      };

      const { data, error } = await supabase
        .from('platform_settings')
        .upsert({
          id: 'default',
          platform_identity: nextIdentity,
          updated_by: ctx.user.id,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, platformSettings: data });
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur Super Admin' },
      { status: 500 }
    );
  }
}
