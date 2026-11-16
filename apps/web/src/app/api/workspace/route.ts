import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

const updateWorkspaceSettingsSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  workspaceName: z.string().trim().min(2).max(80).optional(),
  inboxEnterToSend: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parseRes = updateWorkspaceSettingsSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();
    const { fullName, workspaceName } = parseRes.data;

    if (fullName !== undefined) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: nowIso })
        .eq('id', ctx.user.id);
    }

    if (workspaceName !== undefined) {
      await supabase
        .from('workspaces')
        .update({ name: workspaceName, updated_at: nowIso })
        .eq('id', ctx.workspace.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur mise à jour paramètres' },
      { status: 500 }
    );
  }
}
