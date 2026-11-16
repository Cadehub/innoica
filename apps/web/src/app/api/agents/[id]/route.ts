import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyPlanWatermark, resolveOfficialAppUrl } from '@innoica/shared';
import { decryptSecret } from '@innoica/shared/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';

const updateAgentSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  primary_language: z.enum(['fr', 'en']).optional(),
  system_prompt: z.string().trim().min(10).max(5000).optional(),
  personality_traits: z.array(z.string()).optional(),
  ai_provider: z.enum(['openrouter', 'groq', 'gemini', 'openai']).optional(),
  ai_model: z.string().trim().min(2).optional(),
  ai_temperature: z.number().min(0).max(1).optional(),
  is_memory_enabled: z.boolean().optional(),
  ai_credential_id: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'paused', 'draft']).optional(),
});

const testPromptSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function runLiveByokCompletion(params: {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
}): Promise<string> {
  const { provider, model, apiKey, systemPrompt, userMessage, temperature } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { temperature, maxOutputTokens: 600 },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Erreur Gemini HTTP ${res.status}`);
      }
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const endpoint =
      provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = resolveOfficialAppUrl();
      headers['X-Title'] = 'Innoica Agent Studio';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 600,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Erreur fournisseur HTTP ${res.status}`);
    }
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parseRes = updateAgentSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: parseRes.error.format() },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('agents')
      .update({
        ...parseRes.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', ctx.workspace.id)
      .select('*')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Agent introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, agent: data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur mise à jour agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ctx.workspace.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur suppression agent' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parseRes = testPromptSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: 'Message de test requis' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const ctx = await getActiveWorkspaceContext(supabase);
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', ctx.workspace.id)
      .single();

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agent introuvable' }, { status: 404 });
    }

    const credQuery = agent.ai_credential_id
      ? supabase
          .from('ai_credentials')
          .select('encrypted_api_key, provider')
          .eq('id', agent.ai_credential_id)
          .single()
      : supabase
          .from('ai_credentials')
          .select('encrypted_api_key, provider')
          .eq('workspace_id', ctx.workspace.id)
          .eq('provider', agent.ai_provider)
          .eq('is_valid', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

    const [{ data: cred }, { data: chunks }] = await Promise.all([
      credQuery,
      supabase
        .from('agent_knowledge_chunks')
        .select('content')
        .eq('agent_id', agent.id)
        .limit(6),
    ]);

    if (!cred?.encrypted_api_key) {
      return NextResponse.json(
        {
          success: false,
          error: `Aucune clé API BYOK valide configurée pour le fournisseur ${agent.ai_provider}.`,
        },
        { status: 400 }
      );
    }

    const apiKey = decryptSecret(cred.encrypted_api_key);
    const knowledgeBlock =
      chunks && chunks.length > 0
        ? `\n\n[CONNAISSANCES]\n${chunks.map((c: any) => c.content).join('\n---\n')}`
        : '';

    const rawReply = await runLiveByokCompletion({
      provider: agent.ai_provider,
      model: agent.ai_model,
      apiKey,
      systemPrompt: `${agent.system_prompt}${knowledgeBlock}`,
      userMessage: parseRes.data.message,
      temperature: Number(agent.ai_temperature ?? 0.7),
    });

    const hasWatermark = ctx.quota?.hasWatermark ?? true;
    const finalReply = applyPlanWatermark(rawReply, {
      hasWatermark,
      language: agent.primary_language === 'en' ? 'en' : 'fr',
      officialUrl: resolveOfficialAppUrl(),
    });

    return NextResponse.json({
      success: true,
      reply: finalReply,
      hasWatermark,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur lors du test IA' },
      { status: 500 }
    );
  }
}
