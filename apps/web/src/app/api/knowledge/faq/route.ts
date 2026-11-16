import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { knowledgeFaqSchema } from '@innoica/shared';
import { persistKnowledgeSource, verifyAgentAccess } from '@/lib/knowledge/ingestion';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = knowledgeFaqSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'Données FAQ invalides', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const { agentId, question, answer } = parseRes.data;
    const supabase = await createClient();
    const access = await verifyAgentAccess(supabase, agentId);
    if (access.error) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const formattedFaq = `Question: ${question}\nRéponse: ${answer}`;
    const result = await persistKnowledgeSource(supabase, {
      agentId,
      sourceType: 'faq',
      title: question,
      rawContent: formattedFaq,
    });

    return NextResponse.json({
      success: true,
      source: result.source,
      sourceId: result.source.id,
      chunkCount: result.chunkCount,
    });
  } catch (err: any) {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur lors de l\'ajout de la FAQ' },
      { status }
    );
  }
}
