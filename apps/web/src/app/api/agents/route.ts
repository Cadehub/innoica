import { NextResponse } from 'next/server';
import { agentFormSchema } from '@innoica/shared';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export async function GET() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('agents')
    .select('*, whatsapp_connections(*), ai_credentials(id, provider, label, key_hint, is_valid)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, agents: data || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = agentFormSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    if (ctx.workspace.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Ce workspace est actuellement suspendu.' },
        { status: 403 }
      );
    }

    const maxAgents = ctx.quota?.maxAgents ?? 1;
    const { count } = await supabase
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspace.id);

    if ((count ?? 0) >= maxAgents) {
      return NextResponse.json(
        {
          success: false,
          error: `Limite d'agents atteinte (${maxAgents} agent maximum sur votre offre ${
            ctx.quota?.planSlug === 'starter' ? 'Starter' : 'Free'
          }). Passez sur Starter pour créer jusqu'à 2 agents.`,
          code: 'PLAN_AGENT_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    const input = parseRes.data;
    const templateSlug = input.template_slug;
    let templateId: string | null = null;
    if (templateSlug) {
      const { data: tpl } = await supabase
        .from('agent_templates')
        .select('id')
        .eq('slug', templateSlug)
        .maybeSingle();
      templateId = tpl?.id || null;
    }

    const { data: agent, error: insertErr } = await supabase
      .from('agents')
      .insert({
        workspace_id: ctx.workspace.id,
        template_id: templateId,
        name: input.name,
        description: input.description || null,
        primary_language: input.primary_language,
        system_prompt: input.system_prompt,
        personality_traits: input.personality_traits,
        ai_provider: input.ai_provider,
        ai_model: input.ai_model,
        ai_temperature: input.ai_temperature,
        is_memory_enabled: input.is_memory_enabled,
        ai_credential_id: input.ai_credential_id || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (insertErr || !agent) {
      return NextResponse.json(
        { success: false, error: insertErr?.message || 'Erreur création agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, agent }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
