import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from '@innoica/shared/server';
import { validateProviderApiKey } from '@/lib/provider-tester';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, apiKey, credentialId } = body;

    let targetProvider = provider;
    let targetKey = apiKey;

    // Si on teste une clé existante par son ID
    if (credentialId) {
      const { data: cred, error: fetchErr } = await supabase
        .from('ai_credentials')
        .select('provider, encrypted_api_key')
        .eq('id', credentialId)
        .single();

      if (fetchErr || !cred) {
        return NextResponse.json({ error: 'Clé introuvable' }, { status: 404 });
      }

      targetProvider = cred.provider;
      targetKey = decryptSecret(cred.encrypted_api_key);
    }

    if (!targetProvider || !targetKey) {
      return NextResponse.json(
        { error: 'Fournisseur ou clé API manquant pour le test' },
        { status: 400 }
      );
    }

    const result = await validateProviderApiKey(targetProvider, targetKey);

    // Mettre à jour l'état de validation en base si c'est une clé existante
    if (credentialId) {
      await supabase
        .from('ai_credentials')
        .update({
          is_valid: result.isValid,
          last_tested_at: new Date().toISOString(),
        })
        .eq('id', credentialId);
    }

    return NextResponse.json({
      success: result.isValid,
      message: result.message,
      details: result.details,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
