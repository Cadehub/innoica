import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changeControlModeSchema } from '@innoica/shared';
import { createClient } from '@/lib/supabase/server';

const patchConversationSchema = z.object({
  conversationId: z.string().uuid(),
  controlMode: changeControlModeSchema.shape.controlMode.optional(),
  internalNotes: z.string().max(4000).optional(),
  markRead: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parseRes = patchConversationSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    const { conversationId, controlMode, internalNotes, markRead, reason } = parseRes.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const { data: existing, error: findErr } = await supabase
      .from('conversations')
      .select('id, control_mode')
      .eq('id', conversationId)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ success: false, error: 'Conversation introuvable' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, any> = { updated_at: nowIso };
    if (controlMode) updates.control_mode = controlMode;
    if (internalNotes !== undefined) updates.internal_notes = internalNotes;
    if (markRead) updates.unread_count = 0;

    const { data: updated, error: updateErr } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    if (controlMode && controlMode !== existing.control_mode) {
      if (controlMode === 'human_takeover') {
        await supabase.from('human_handoffs').insert({
          conversation_id: conversationId,
          operator_id: user.id,
          reason: reason || 'Prise en main manuelle (Inbox)',
          started_at: nowIso,
        });
      } else if (existing.control_mode === 'human_takeover' && controlMode === 'ai_active') {
        await supabase
          .from('human_handoffs')
          .update({ ended_at: nowIso })
          .eq('conversation_id', conversationId)
          .is('ended_at', null);
      }
    }

    return NextResponse.json({ success: true, conversation: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur mise à jour conversation' },
      { status: 500 }
    );
  }
}
