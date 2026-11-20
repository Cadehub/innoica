import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { WhatsAppChannelConfigSchema } from '@innoica/shared';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  let query = supabase
    .from('whatsapp_channel_configs')
    .select('*')
    .eq('workspace_id', ctx.workspace.id);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data: channels, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channels: channels || [] });
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
    const parsed = WhatsAppChannelConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Configuration de chaîne invalide', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { data: channel, error } = await supabase
      .from('whatsapp_channel_configs')
      .upsert(
        {
          workspace_id: ctx.workspace.id,
          agent_id: agentId,
          channel_jid: parsed.data.channel_jid,
          channel_name: parsed.data.channel_name,
          is_active: parsed.data.is_active,
          auto_publish_enabled: parsed.data.auto_publish_enabled,
          require_human_approval: parsed.data.require_human_approval,
          custom_instructions: parsed.data.custom_instructions || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id,channel_jid' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, channel });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur enregistrement chaîne' },
      { status: 500 }
    );
  }
}
