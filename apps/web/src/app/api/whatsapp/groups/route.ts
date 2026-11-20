import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { WhatsAppGroupConfigSchema } from '@innoica/shared';

const WHATSAPP_WORKER_URL = process.env.WHATSAPP_WORKER_URL || 'http://localhost:4001';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json({ error: 'agentId requis' }, { status: 400 });
  }

  // 1. Récupérer les configs enregistrées dans Supabase
  const { data: savedConfigs } = await supabase
    .from('whatsapp_group_configs')
    .select('*')
    .eq('workspace_id', ctx.workspace.id)
    .eq('agent_id', agentId);

  // 2. Interroger le worker Baileys pour les groupes réels
  let liveGroups: any[] = [];
  try {
    const res = await fetch(`${WHATSAPP_WORKER_URL}/api/sessions/${agentId}/groups`, {
      method: 'GET',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.groups) {
      liveGroups = data.groups;
    }
  } catch {
    // Si worker temporairement inaccessible, continuer avec les configs locales
  }

  // 3. Fusionner
  const mergedGroups = liveGroups.map((g: any) => {
    const saved = savedConfigs?.find((sc) => sc.group_jid === g.id);
    return {
      group_jid: g.id,
      group_name: g.subject || 'Groupe sans nom',
      size: g.size || g.participantsCount || 0,
      isBotAdmin: g.isBotAdmin || false,
      desc: g.desc || '',
      is_active: saved?.is_active ?? false,
      monitor_mode: saved?.monitor_mode || 'mentions_only',
      keywords: saved?.keywords || [],
      custom_instructions: saved?.custom_instructions || '',
      allow_admin_actions: saved?.allow_admin_actions || false,
    };
  });

  return NextResponse.json({ groups: mergedGroups });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json({ error: 'agentId requis' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = WhatsAppGroupConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Configuration de groupe invalide', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { data: config, error } = await supabase
      .from('whatsapp_group_configs')
      .upsert(
        {
          workspace_id: ctx.workspace.id,
          agent_id: agentId,
          group_jid: parsed.data.group_jid,
          group_name: parsed.data.group_name,
          is_active: parsed.data.is_active,
          monitor_mode: parsed.data.monitor_mode,
          keywords: parsed.data.keywords,
          custom_instructions: parsed.data.custom_instructions || null,
          allow_admin_actions: parsed.data.allow_admin_actions,
          allowed_participants: parsed.data.allowed_participants,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id,group_jid' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, config });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur enregistrement groupe' },
      { status: 500 }
    );
  }
}
