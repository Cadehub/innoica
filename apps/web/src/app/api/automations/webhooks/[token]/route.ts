import { NextRequest, NextResponse } from 'next/server';
import { createWorkerSupabaseClient } from '@innoica/database';

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  const { token } = params;
  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
  }

  const supabase = createWorkerSupabaseClient();

  try {
    const { data: webhook, error } = await supabase
      .from('workflow_webhooks')
      .select('*, workflow:workflow_definitions(*)')
      .eq('endpoint_token', token)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !webhook || !webhook.workflow) {
      return NextResponse.json({ error: 'Webhook introuvable ou inactif' }, { status: 404 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      payload = { raw: await req.text().catch(() => '') };
    }

    // Mettre à jour last_called_at
    await supabase
      .from('workflow_webhooks')
      .update({ last_called_at: new Date().toISOString() })
      .eq('id', webhook.id);

    // Déclencher le workflow via AI Runtime
    const aiRuntimeUrl = process.env.AI_RUNTIME_URL || 'http://localhost:4002';
    const dispatchRes = await fetch(`${aiRuntimeUrl}/api/automation/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: webhook.workspace_id,
        agentId: webhook.workflow.agent_id || null,
        triggerType: webhook.workflow.trigger_type || 'business_lead_created',
        payload: {
          ...payload,
          webhook_token: token,
          received_at: new Date().toISOString(),
        },
        idempotencyKey: `wh:${token}:${Date.now()}`,
      }),
    });

    const result = await dispatchRes.json().catch(() => ({}));
    return NextResponse.json({ success: true, dispatched: true, result });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur exécution webhook entrant' },
      { status: 500 }
    );
  }
}
