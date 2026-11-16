import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { persistKnowledgeSource, verifyAgentAccess } from '@/lib/knowledge/ingestion';

const txtSchema = z.object({
  agentId: z.string().uuid(),
  title: z.string().min(2).max(200),
  content: z.string().min(10).max(200000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = txtSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'Titre (min 2 car.) et contenu (min 10 car.) requis' },
        { status: 400 }
      );
    }

    const { agentId, title, content } = parseRes.data;
    const supabase = await createClient();
    const access = await verifyAgentAccess(supabase, agentId);
    if (access.error) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const result = await persistKnowledgeSource(supabase, {
      agentId,
      sourceType: 'txt',
      title: title.trim(),
      rawContent: content,
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
      { success: false, error: err.message || 'Erreur lors de l\'ingestion du document texte' },
      { status }
    );
  }
}
