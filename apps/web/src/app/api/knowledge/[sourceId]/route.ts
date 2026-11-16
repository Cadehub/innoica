import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    // Delete chunks first, then source (RLS enforces workspace ownership)
    await supabase.from('agent_knowledge_chunks').delete().eq('source_id', sourceId);
    const { error } = await supabase
      .from('agent_knowledge_sources')
      .delete()
      .eq('id', sourceId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
