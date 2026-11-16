import { NextResponse } from 'next/server';
import { z } from 'zod';
import { memoryUpsertSchema } from '@innoica/shared';
import { createClient } from '@/lib/supabase/server';

const deleteMemorySchema = z.object({
  scope: z.enum(['contact', 'conversation']),
  id: z.string().uuid(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get('contactId');
  const conversationId = searchParams.get('conversationId');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
  }

  const [contactMemRes, convMemRes] = await Promise.all([
    contactId
      ? supabase
          .from('contact_memories')
          .select('*')
          .eq('contact_id', contactId)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    conversationId
      ? supabase
          .from('conversation_memories')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    success: true,
    contactMemories: contactMemRes.data || [],
    conversationMemories: convMemRes.data || [],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = memoryUpsertSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ success: false, error: 'Données mémoire invalides' }, { status: 400 });
    }

    const { scope, targetId, key, value } = parseRes.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();
    if (scope === 'contact') {
      const { data, error } = await supabase
        .from('contact_memories')
        .upsert(
          {
            contact_id: targetId,
            key,
            value,
            confidence: 1,
            updated_at: nowIso,
          },
          { onConflict: 'contact_id,key' }
        )
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, memory: data });
    }

    const { data, error } = await supabase
      .from('conversation_memories')
      .upsert(
        {
          conversation_id: targetId,
          key,
          value,
          confidence: 1,
          updated_at: nowIso,
        },
        { onConflict: 'conversation_id,key' }
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, memory: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Erreur mémoire' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const parseRes = deleteMemorySchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 });
    }

    const { scope, id } = parseRes.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const table = scope === 'contact' ? 'contact_memories' : 'conversation_memories';
    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Erreur suppression' }, { status: 500 });
  }
}
