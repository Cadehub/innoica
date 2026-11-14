import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptSecret, maskApiKey, aiCredentialCreateSchema } from '@innoica/shared/server';
import { validateProviderApiKey } from '@/lib/provider-tester';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 });
  }

  const { data: credentials, error } = await supabase
    .from('ai_credentials')
    .select('id, provider, label, key_hint, is_valid, last_tested_at, created_at')
    .eq('workspace_id', member.workspace_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ credentials });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parseRes = aiCredentialCreateSchema.safeParse(body);

    if (!parseRes.success) {
      return NextResponse.json({ error: 'Validation échouée', details: parseRes.error.format() }, { status: 400 });
    }

    const { provider, label, apiKey } = parseRes.data;

    // Récupérer le workspace de l'utilisateur
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 });
    }

    // Tester d'abord la clé auprès de l'API officielle
    const validation = await validateProviderApiKey(provider, apiKey);

    // Chiffrement serveur AES-256-GCM
    const encryptedApiKey = encryptSecret(apiKey);
    const keyHint = maskApiKey(apiKey);

    const { data: credential, error: insertError } = await supabase
      .from('ai_credentials')
      .insert({
        workspace_id: member.workspace_id,
        provider,
        label,
        encrypted_api_key: encryptedApiKey,
        key_hint: keyHint,
        is_valid: validation.isValid,
        last_tested_at: new Date().toISOString(),
      })
      .select('id, provider, label, key_hint, is_valid, last_tested_at, created_at')
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      success: true,
      credential,
      validation,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID requis' }, { status: 400 });
  }

  const { error } = await supabase.from('ai_credentials').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
