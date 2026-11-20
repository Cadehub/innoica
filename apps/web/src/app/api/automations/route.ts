import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { CreateWorkflowSchema } from '@innoica/shared';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');

  let query = supabase
    .from('workflow_definitions')
    .select('*, agent:agents(id, name, status)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  if (domain && domain !== 'all') {
    query = query.eq('domain', domain);
  }

  const { data: workflows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflows: workflows || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CreateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données de workflow invalides', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { data: workflow, error } = await supabase
      .from('workflow_definitions')
      .insert({
        workspace_id: ctx.workspace.id,
        agent_id: parsed.data.agent_id || null,
        name: parsed.data.name,
        description: parsed.data.description || null,
        domain: parsed.data.domain,
        natural_instruction: parsed.data.natural_instruction || null,
        trigger_type: parsed.data.trigger_type,
        trigger_config: parsed.data.trigger_config,
        conditions: parsed.data.conditions,
        steps: parsed.data.steps,
        status: parsed.data.status,
        priority: parsed.data.priority,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, workflow });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur création workflow' },
      { status: 500 }
    );
  }
}
