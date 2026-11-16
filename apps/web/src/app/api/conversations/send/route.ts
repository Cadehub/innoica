import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = sendSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ success: false, error: 'Données invalides' }, { status: 400 });
    }

    const { conversationId, content } = parseRes.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, agent_id, control_mode, contacts(phone_number)')
      .eq('id', conversationId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ success: false, error: 'Conversation introuvable' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (conversation.control_mode !== 'human_takeover') {
      await Promise.all([
        supabase
          .from('conversations')
          .update({
            control_mode: 'human_takeover',
            unread_count: 0,
            last_message_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', conversationId),
        supabase.from('human_handoffs').insert({
          conversation_id: conversationId,
          operator_id: user.id,
          reason: 'Réponse manuelle depuis Inbox',
          started_at: nowIso,
        }),
      ]);
    } else {
      await supabase
        .from('conversations')
        .update({
          unread_count: 0,
          last_message_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', conversationId);
    }

    const toPhone = (conversation.contacts as any)?.phone_number;
    const workerUrl =
      process.env.WHATSAPP_WORKER_URL ||
      process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL ||
      'http://localhost:4001';

    let waMessageId: string | null = null;
    let workerDelivered = false;

    if (toPhone) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const workerRes = await fetch(
          `${workerUrl}/api/sessions/${conversation.agent_id}/send`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toPhone, text: content.trim() }),
            signal: controller.signal,
          }
        );
        if (workerRes.ok) {
          const workerData = await workerRes.json();
          waMessageId = workerData.messageId || null;
          workerDelivered = true;
        }
      } catch {
        // Worker hors ligne : message enregistré en file locale (pending)
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const { data: newMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        wa_message_id: waMessageId,
        sender_type: 'human',
        content: content.trim(),
        delivery_status: workerDelivered ? 'sent' : 'pending',
        created_at: nowIso,
      })
      .select()
      .single();

    if (msgErr) {
      return NextResponse.json({ success: false, error: msgErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: newMsg,
      workerDelivered,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur lors de l\'envoi' },
      { status: 500 }
    );
  }
}
