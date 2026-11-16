import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { verifyAgentAccess } from '@/lib/knowledge/ingestion';

const disconnectSchema = z.object({
  agentId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = disconnectSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ success: false, error: 'agentId invalide' }, { status: 400 });
    }

    const { agentId } = parseRes.data;
    const supabase = await createClient();
    const access = await verifyAgentAccess(supabase, agentId);
    if (access.error) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    await supabase
      .from('whatsapp_connections')
      .update({
        status: 'disconnected',
        pairing_code: null,
        pairing_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId);

    const workerUrl =
      process.env.WHATSAPP_WORKER_URL ||
      process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL ||
      'http://localhost:4001';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      await fetch(`${workerUrl}/api/sessions/${agentId}/disconnect`, {
        method: 'POST',
        signal: controller.signal,
      });
    } catch {
      // Worker hors ligne : la déconnexion en base reste valide
    } finally {
      clearTimeout(timeoutId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}
