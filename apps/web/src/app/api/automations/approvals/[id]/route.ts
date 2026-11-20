import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

export async function POST(
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
    const decision = body.decision; // 'approved' | 'rejected'

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ error: 'Décision invalide (approved ou rejected)' }, { status: 400 });
    }

    const { data: user } = await supabase.auth.getUser();

    // 1. Mettre à jour l'approbation
    const { data: approval, error: appErr } = await supabase
      .from('workflow_approvals')
      .update({
        status: decision,
        resolved_by: user.user?.id || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', ctx.workspace.id)
      .select()
      .single();

    if (appErr || !approval) {
      return NextResponse.json({ error: appErr?.message || 'Approbation introuvable' }, { status: 404 });
    }

    // 2. Si approuvé, relancer l'exécution
    if (decision === 'approved') {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'running',
        })
        .eq('id', approval.execution_id);
    } else {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_details: { reason: 'Refusé par l’opérateur humain' },
        })
        .eq('id', approval.execution_id);
    }

    // 3. Notifier l'AI Runtime pour reprendre le flux DAG
    const aiRuntimeUrl = process.env.AI_RUNTIME_URL || 'http://localhost:4002';
    try {
      await fetch(`${aiRuntimeUrl}/api/automation/resume-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: approval.execution_id,
          decision,
          approverId: user.user?.id || null,
        }),
      });
    } catch (notifyErr) {
      console.error('[Approvals] Erreur notification AI Runtime:', notifyErr);
    }

    return NextResponse.json({ success: true, decision, approval });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur traitement approbation' },
      { status: 500 }
    );
  }
}
