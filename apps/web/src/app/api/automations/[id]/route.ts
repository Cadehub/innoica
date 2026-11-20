import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { compileNaturalInstruction } from '@innoica/shared';

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    // Si une recompilation automatique depuis une nouvelle consigne en langage naturel est demandée
    const newInstruction = body.natural_instruction || body.instruction;
    if (body.recompile && newInstruction && typeof newInstruction === 'string') {
      const compileRes = compileNaturalInstruction(newInstruction, { locale: 'fr' });
      if (!compileRes.success || !compileRes.workflow) {
        return NextResponse.json(
          { error: compileRes.error || 'Échec de compilation de la nouvelle consigne' },
          { status: 400 }
        );
      }
      updateData.name = body.name || compileRes.workflow.name;
      updateData.description = compileRes.workflow.description;
      updateData.domain = compileRes.workflow.domain;
      updateData.trigger_type = compileRes.workflow.trigger_type;
      updateData.trigger_config = compileRes.workflow.trigger_config;
      updateData.conditions = compileRes.workflow.conditions;
      updateData.steps = compileRes.workflow.steps;
      updateData.natural_instruction = newInstruction;
    } else {
      const allowedFields = [
        'name',
        'description',
        'status',
        'conditions',
        'steps',
        'priority',
        'natural_instruction',
        'trigger_type',
        'trigger_config',
        'domain',
      ];

      for (const f of allowedFields) {
        if (f in body) {
          updateData[f] = body[f];
        }
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('workflow_definitions')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', ctx.workspace.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, workflow: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur mise à jour workflow' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = params;

  const { error } = await supabase
    .from('workflow_definitions')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
