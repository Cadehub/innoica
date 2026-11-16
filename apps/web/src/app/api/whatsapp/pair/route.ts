import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestPairingCodeSchema } from '@innoica/shared';
import { verifyAgentAccess } from '@/lib/knowledge/ingestion';

const pairingRateLimiter = new Map<string, number[]>();

function isRateLimited(key: string, maxRequests = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (pairingRateLimiter.get(key) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= maxRequests) {
    pairingRateLimiter.set(key, recent);
    return true;
  }
  recent.push(now);
  pairingRateLimiter.set(key, recent);
  return false;
}

function getWorkerUrl(): string {
  return (
    process.env.WHATSAPP_WORKER_URL ||
    process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL ||
    'http://localhost:4001'
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseRes = requestPairingCodeSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Numéro invalide. Utilisez un indicatif international valide (ex: +237691234567).',
          details: parseRes.error.format(),
        },
        { status: 400 }
      );
    }

    const { agentId, phoneNumber } = parseRes.data;
    const supabase = await createClient();
    const access = await verifyAgentAccess(supabase, agentId);
    if (access.error || !access.agent) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    if (isRateLimited(`pair:${access.agent.workspace_id}:${agentId}`)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trop de demandes de code en 1 minute. Veuillez patienter quelques instants.',
        },
        { status: 429 }
      );
    }

    const { data: planRows } = await supabase.rpc('resolve_effective_workspace_plan', {
      p_workspace_id: access.agent.workspace_id,
    });
    const plan = Array.isArray(planRows) ? planRows[0] : planRows;
    if (plan) {
      if (plan.workspace_status && plan.workspace_status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'Ce workspace est actuellement suspendu.' },
          { status: 403 }
        );
      }

      const maxConnections = plan.max_connections ?? 1;
      const { count } = await supabase
        .from('whatsapp_connections')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', access.agent.workspace_id)
        .neq('agent_id', agentId)
        .in('status', ['pairing', 'connected']);

      if ((count ?? 0) >= maxConnections) {
        return NextResponse.json(
          {
            success: false,
            error: `Limite de connexions WhatsApp atteinte (${maxConnections} numéro${
              maxConnections > 1 ? 's' : ''
            } max sur votre offre ${plan.plan_slug === 'starter' ? 'Starter' : 'Free'}).`,
            code: 'PLAN_CONNECTION_LIMIT_REACHED',
          },
          { status: 403 }
        );
      }
    }

    const nowIso = new Date().toISOString();

    // Enregistrer ou mettre à jour la fiche de connexion en base
    const { data: existingConn } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('agent_id', agentId)
      .maybeSingle();

    if (existingConn) {
      await supabase
        .from('whatsapp_connections')
        .update({
          phone_number: phoneNumber,
          status: 'pairing',
          updated_at: nowIso,
        })
        .eq('id', existingConn.id);
    } else {
      await supabase.from('whatsapp_connections').insert({
        agent_id: agentId,
        workspace_id: access.agent.workspace_id,
        phone_number: phoneNumber,
        status: 'pairing',
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    // Appel serveur-à-serveur vers le WhatsApp Worker (Baileys, Pairing Code uniquement)
    const workerUrl = getWorkerUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const workerRes = await fetch(`${workerUrl}/api/sessions/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, phoneNumber }),
        signal: controller.signal,
      });

      const workerData = await workerRes.json();
      if (!workerRes.ok || !workerData.success) {
        return NextResponse.json(
          {
            success: false,
            error: workerData.error || 'Échec de la génération du Pairing Code par le worker.',
            phoneSaved: true,
          },
          { status: workerRes.status >= 400 ? workerRes.status : 502 }
        );
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase
        .from('whatsapp_connections')
        .update({
          pairing_code: workerData.pairingCode || null,
          pairing_code_expires_at: workerData.pairingCode ? expiresAt : null,
          status: workerData.status || 'pairing',
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', agentId);

      return NextResponse.json({
        success: true,
        agentId,
        phoneNumber,
        status: workerData.status || 'pairing',
        pairingCode: workerData.pairingCode || null,
      });
    } catch (workerErr: any) {
      const isAbort = workerErr?.name === 'AbortError';
      return NextResponse.json(
        {
          success: false,
          phoneSaved: true,
          error: isAbort
            ? `Le WhatsApp Worker (${workerUrl}) a mis trop de temps à répondre.`
            : `Le WhatsApp Worker Baileys n'est pas joignable sur ${workerUrl}. Numéro sauvegardé, mais démarrez le service whatsapp-worker pour générer le Pairing Code.`,
        },
        { status: 503 }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur serveur lors de l\'appairage' },
      { status: 500 }
    );
  }
}
