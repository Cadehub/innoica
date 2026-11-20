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
    const body = await req.json();
    const parsed = CompileNaturalInstructionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { instruction, agent_id, preferred_domain } = parsed.data;

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
