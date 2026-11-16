import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { knowledgeUrlSchema } from '@innoica/shared';
import {
  persistKnowledgeSource,
  scrapePublicUrl,
  verifyAgentAccess,
} from '@/lib/knowledge/ingestion';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = knowledgeUrlSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'URL invalide ou malformée', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const { agentId, title, url } = parseRes.data;
    const supabase = await createClient();
    const access = await verifyAgentAccess(supabase, agentId);
    if (access.error) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const scrapeResult = await scrapePublicUrl(url);
    const result = await persistKnowledgeSource(supabase, {
      agentId,
      sourceType: 'url',
      title: title?.trim() || scrapeResult.title,
      rawContent: scrapeResult.content,
      sourceUrl: url,
    });

    return NextResponse.json({
      success: true,
      source: result.source,
      sourceId: result.source.id,
      extractedTitle: scrapeResult.title,
      chunkCount: result.chunkCount,
    });
  } catch (err: any) {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur lors de l\'ingestion de l\'URL' },
      { status }
    );
  }
}
