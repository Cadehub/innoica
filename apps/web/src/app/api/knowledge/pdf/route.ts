import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@innoica/shared';
import { extractTextFromPdfBuffer, isValidPdfSignature } from '@innoica/shared/server';
import { createClient } from '@/lib/supabase/server';
import { persistKnowledgeSource, verifyAgentAccess } from '@/lib/knowledge/ingestion';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const agentId = String(formData.get('agentId') || '').trim();
    const rawTitle = String(formData.get('title') || '').trim();
    const file = formData.get('file');

    if (!agentId || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'agentId et fichier PDF requis.' },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > APP_CONFIG.limits.maxPdfSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `Le fichier PDF doit peser entre 1 octet et ${Math.round(
            APP_CONFIG.limits.maxPdfSizeBytes / (1024 * 1024)
          )} Mo.`,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const access = await verifyAgentAccess(supabase, agentId);
    if (access.error) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isValidPdfSignature(bytes)) {
      return NextResponse.json(
        { success: false, error: 'Le fichier envoyé n’est pas un PDF valide (%PDF- requis).' },
        { status: 400 }
      );
    }

    const extracted = await extractTextFromPdfBuffer(bytes, APP_CONFIG.limits.maxPdfSizeBytes);
    const title = rawTitle || file.name.replace(/\.pdf$/i, '') || 'Document PDF';

    const result = await persistKnowledgeSource(supabase, {
      agentId,
      sourceType: 'pdf',
      title,
      rawContent: extracted.text,
    });

    return NextResponse.json({
      success: true,
      source: result.source,
      sourceId: result.source.id,
      chunkCount: result.chunkCount,
      totalPages: extracted.totalPages,
    });
  } catch (err: any) {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 400;
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur lors de l’ingestion du PDF' },
      { status }
    );
  }
}
