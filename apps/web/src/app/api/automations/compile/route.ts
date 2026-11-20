import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { compileNaturalInstruction, CompileNaturalInstructionSchema } from '@innoica/shared';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const rawBody = await req.json();
    const normalizedAgentId = rawBody.agent_id || rawBody.agentId || undefined;
    const cleanAgentId = normalizedAgentId && typeof normalizedAgentId === 'string' && normalizedAgentId.trim() !== ''
      ? normalizedAgentId.trim()
      : undefined;

    const parsed = CompileNaturalInstructionSchema.safeParse({
      ...rawBody,
      agent_id: cleanAgentId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { instruction, agent_id, preferred_domain } = parsed.data;

    const aiRuntimeUrl = process.env.AI_RUNTIME_URL || 'http://localhost:4002';
    try {
      const aiRes = await fetch(`${aiRuntimeUrl}/api/automation/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          agentId: agent_id || undefined,
          workspaceId: ctx.workspace.id,
          preferredDomain: preferred_domain,
          locale: 'fr',
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData?.success) {
          return NextResponse.json(aiData);
        }
      }
    } catch {
      // Fallback local en cas d'indisponibilité temporaire du runtime
    }

    const result = compileNaturalInstruction(instruction, {
      agentId: agent_id,
      preferredDomain: preferred_domain,
      locale: 'fr',
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Erreur interne de compilation' },
      { status: 500 }
    );
  }
}
