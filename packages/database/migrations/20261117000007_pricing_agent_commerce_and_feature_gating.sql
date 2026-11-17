-- ====================================================================
-- INNOICA Agent Studio — Commercial Offers & Server-Side Feature Gating
-- Migration 007: INNOICA Agent (3 500 FCFA), INNOICA Commerce (6 500 FCFA),
-- Starter Grandfathering, Entitlement RPC & Quota Capabilities
-- ====================================================================

-- 1. Ensure capabilities JSONB column on plans has proper default
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{"voice_message_understanding": false, "ecommerce_store": false}'::jsonb;

-- 2. Update Free Plan
UPDATE public.plans
SET
    capabilities = '{"voice_message_understanding": false, "ecommerce_store": false}'::jsonb,
    features = '[
      "1 Agent IA WhatsApp",
      "1 Numéro WhatsApp connecté",
      "5 nouvelles conversations / jour",
      "10 réponses IA / conversation / jour",
      "BYOK (OpenRouter, Groq, Gemini, OpenAI)",
      "Base de connaissances (FAQ & TXT)",
      "Historique conservé 7 jours",
      "Messages texte uniquement (vocaux réservés aux plans payants)",
      "Signature INNOICA sur les réponses IA"
    ]'::jsonb,
    is_active = TRUE,
    sort_order = 1,
    updated_at = NOW()
WHERE slug = 'free';

-- 3. Upsert INNOICA Agent Plan (3 500 FCFA / mo, 37 800 FCFA / yr)
INSERT INTO public.plans (
    slug, name_fr, name_en, description_fr, description_en,
    price_monthly_xaf, price_yearly_xaf, max_agents, max_connections,
    max_knowledge_docs, max_daily_new_conversations, max_daily_bot_replies_per_conv,
    history_retention_days, has_watermark, allowed_knowledge_types,
    capabilities, features, is_active, sort_order
)
VALUES
(
    'agent',
    'INNOICA Agent',
    'INNOICA Agent',
    'Agent IA WhatsApp complet avec compréhension vocale native et quotas illimités.',
    'Full WhatsApp AI agent with native voice understanding and unlimited quotas.',
    3500,
    37800,
    2,
    2,
    25,
    NULL,
    NULL,
    NULL,
    FALSE,
    ARRAY['faq', 'txt', 'pdf', 'url']::TEXT[],
    '{"voice_message_understanding": true, "ecommerce_store": false}'::jsonb,
    '[
      "Jusqu''à 2 Agents IA WhatsApp",
      "Jusqu''à 2 Numéros WhatsApp connectés",
      "Compréhension vocale FR/EN incluse sans frais",
      "Conversations illimitées côté INNOICA",
      "Réponses IA illimitées côté INNOICA",
      "FAQ, PDF, TXT & URLs",
      "Mémoire durable par contact & conversation",
      "Inbox temps réel & Human Takeover",
      "Sans signature publicitaire INNOICA"
    ]'::jsonb,
    TRUE,
    2
)
ON CONFLICT (slug) DO UPDATE SET
    name_fr = EXCLUDED.name_fr,
    name_en = EXCLUDED.name_en,
    description_fr = EXCLUDED.description_fr,
    description_en = EXCLUDED.description_en,
    price_monthly_xaf = EXCLUDED.price_monthly_xaf,
    price_yearly_xaf = EXCLUDED.price_yearly_xaf,
    max_agents = EXCLUDED.max_agents,
    max_connections = EXCLUDED.max_connections,
    max_knowledge_docs = EXCLUDED.max_knowledge_docs,
    has_watermark = EXCLUDED.has_watermark,
    capabilities = EXCLUDED.capabilities,
    features = EXCLUDED.features,
    is_active = TRUE,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 4. Upsert INNOICA Commerce Plan (6 500 FCFA / mo, 70 200 FCFA / yr)
INSERT INTO public.plans (
    slug, name_fr, name_en, description_fr, description_en,
    price_monthly_xaf, price_yearly_xaf, max_agents, max_connections,
    max_knowledge_docs, max_daily_new_conversations, max_daily_bot_replies_per_conv,
    history_retention_days, has_watermark, allowed_knowledge_types,
    capabilities, features, is_active, sort_order
)
VALUES
(
    'commerce',
    'INNOICA Commerce',
    'INNOICA Commerce',
    'Tout INNOICA Agent + Moteur E-Commerce Natif, Storefront, Catalogue & Commandes Baileys.',
    'Everything in INNOICA Agent + Native E-Commerce Engine, Storefront, Catalog & Baileys Orders.',
    6500,
    70200,
    3,
    3,
    50,
    NULL,
    NULL,
    NULL,
    FALSE,
    ARRAY['faq', 'txt', 'pdf', 'url']::TEXT[],
    '{"voice_message_understanding": true, "ecommerce_store": true}'::jsonb,
    '[
      "Tout le plan INNOICA Agent",
      "Jusqu''à 3 Agents IA WhatsApp et 3 numéros connectés",
      "Boutique en ligne native hébergée par INNOICA",
      "Constructeur visuel sécurisé sans code",
      "Catalogue produits, variantes & gestion des stocks",
      "Paniers & commandes en temps réel",
      "Paiements manuels (Livraison, Retrait, Mobile Money)",
      "Synchronisation catalogue & commandes WhatsApp"
    ]'::jsonb,
    TRUE,
    3
)
ON CONFLICT (slug) DO UPDATE SET
    name_fr = EXCLUDED.name_fr,
    name_en = EXCLUDED.name_en,
    description_fr = EXCLUDED.description_fr,
    description_en = EXCLUDED.description_en,
    price_monthly_xaf = EXCLUDED.price_monthly_xaf,
    price_yearly_xaf = EXCLUDED.price_yearly_xaf,
    max_agents = EXCLUDED.max_agents,
    max_connections = EXCLUDED.max_connections,
    max_knowledge_docs = EXCLUDED.max_knowledge_docs,
    has_watermark = EXCLUDED.has_watermark,
    capabilities = EXCLUDED.capabilities,
    features = EXCLUDED.features,
    is_active = TRUE,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 5. Soft-deactivate 'starter' for new signups while preserving foreign keys for existing subscribers
UPDATE public.plans
SET
    capabilities = '{"voice_message_understanding": true, "ecommerce_store": false}'::jsonb,
    is_active = FALSE,
    sort_order = 4,
    updated_at = NOW()
WHERE slug = 'starter';

-- 6. Create or replace public.resolve_store_entitlement(p_workspace_id UUID)
CREATE OR REPLACE FUNCTION public.resolve_store_entitlement(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_can_ecommerce BOOLEAN := FALSE;
    v_caps JSONB := '{}'::jsonb;
BEGIN
    SELECT * INTO v_plan FROM public.resolve_effective_workspace_plan(p_workspace_id);
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'ecommerce', FALSE, 'planSlug', 'free');
    END IF;

    SELECT COALESCE(capabilities, '{}'::jsonb) INTO v_caps
    FROM public.plans
    WHERE id = v_plan.plan_id;

    IF (v_plan.plan_slug = 'commerce' OR COALESCE((v_caps->>'ecommerce_store')::boolean, FALSE) = TRUE)
       AND COALESCE(v_plan.subscription_status, 'active') = 'active'
       AND (v_plan.current_period_end IS NULL OR v_plan.current_period_end > NOW()) THEN
        v_can_ecommerce := TRUE;
    ELSE
        v_can_ecommerce := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'ecommerce', v_can_ecommerce,
        'planSlug', v_plan.plan_slug,
        'subscriptionStatus', v_plan.subscription_status
    );
END;
$$;

-- 7. Update public.admin_set_workspace_plan to support 'agent' and 'commerce'
CREATE OR REPLACE FUNCTION public.admin_set_workspace_plan(
    p_workspace_id UUID,
    p_plan_slug TEXT,
    p_billing_cycle TEXT DEFAULT 'monthly',
    p_duration_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_plan_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_days INTEGER := GREATEST(1, COALESCE(p_duration_days, 30));
BEGIN
    IF v_admin_id IS NULL OR NOT public.is_current_user_super_admin() THEN
        RAISE EXCEPTION 'Accès Super Admin requis';
    END IF;

    IF p_plan_slug NOT IN ('free', 'agent', 'commerce', 'starter') THEN
        RAISE EXCEPTION 'Offre non autorisée : uniquement free, agent, commerce ou starter';
    END IF;

    SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug LIMIT 1;
    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Offre introuvable';
    END IF;

    UPDATE public.workspaces
    SET plan_id = v_plan_id, updated_at = v_now
    WHERE id = p_workspace_id;

    INSERT INTO public.subscriptions (
        workspace_id, plan_id, billing_cycle, status, current_period_start, current_period_end, updated_at
    )
    VALUES (
        p_workspace_id,
        v_plan_id,
        COALESCE(p_billing_cycle, 'monthly'),
        'active',
        v_now,
        CASE WHEN p_plan_slug = 'free' THEN v_now + INTERVAL '3650 days' ELSE v_now + (v_days || ' days')::INTERVAL END,
        v_now
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        billing_cycle = EXCLUDED.billing_cycle,
        status = 'active',
        current_period_start = v_now,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = v_now;

    RETURN jsonb_build_object('success', TRUE, 'workspaceId', p_workspace_id, 'planSlug', p_plan_slug);
END;
$$;

-- 8. Update public.get_workspace_quota_snapshot to include e-commerce capability in capabilities JSON
CREATE OR REPLACE FUNCTION public.get_workspace_quota_snapshot(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_caps JSONB := '{}'::jsonb;
    v_today DATE := public.current_douala_date();
    v_daily_new_convs INTEGER := 0;
    v_daily_bot_replies INTEGER := 0;
    v_agents_count INTEGER := 0;
    v_connections_count INTEGER := 0;
    v_voice_ok BOOLEAN := FALSE;
    v_ecommerce_ok BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NOT NULL
       AND NOT public.is_workspace_member(p_workspace_id)
       AND NOT public.is_current_user_super_admin() THEN
        RAISE EXCEPTION 'Accès refusé au workspace';
    END IF;

    SELECT * INTO v_plan FROM public.resolve_effective_workspace_plan(p_workspace_id);
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'workspace_not_found');
    END IF;

    SELECT COALESCE(capabilities, '{}'::jsonb) INTO v_caps
    FROM public.plans
    WHERE id = v_plan.plan_id;

    IF v_plan.plan_slug <> 'free'
       AND COALESCE(v_plan.subscription_status, 'active') = 'active'
       AND (v_plan.current_period_end IS NULL OR v_plan.current_period_end > NOW()) THEN
        v_voice_ok := COALESCE((v_caps->>'voice_message_understanding')::boolean, TRUE);
        v_ecommerce_ok := (v_plan.plan_slug = 'commerce' OR COALESCE((v_caps->>'ecommerce_store')::boolean, FALSE));
    ELSE
        v_voice_ok := FALSE;
        v_ecommerce_ok := FALSE;
    END IF;

    SELECT COUNT(*) INTO v_daily_new_convs
    FROM public.daily_conversation_claims
    WHERE workspace_id = p_workspace_id AND period_date = v_today;

    SELECT COUNT(*) INTO v_daily_bot_replies
    FROM public.quota_reply_reservations
    WHERE workspace_id = p_workspace_id AND period_date = v_today AND status = 'confirmed';

    SELECT COUNT(*) INTO v_agents_count
    FROM public.agents WHERE workspace_id = p_workspace_id;

    SELECT COUNT(*) INTO v_connections_count
    FROM public.whatsapp_connections
    WHERE workspace_id = p_workspace_id AND status IN ('pairing', 'connected');

    RETURN jsonb_build_object(
        'workspaceId', v_plan.workspace_id,
        'workspaceStatus', v_plan.workspace_status,
        'planSlug', v_plan.plan_slug,
        'periodDate', v_today::TEXT,
        'hasWatermark', v_plan.has_watermark,
        'hasVoiceUnderstanding', v_voice_ok,
        'hasEcommerceStore', v_ecommerce_ok,
        'capabilities', jsonb_build_object(
            'voice_message_understanding', v_voice_ok,
            'ecommerce_store', v_ecommerce_ok
        ),
        'maxAgents', v_plan.max_agents,
        'maxConnections', v_plan.max_connections,
        'maxKnowledgeDocs', v_plan.max_knowledge_docs,
        'maxDailyNewConversations', v_plan.max_daily_new_conversations,
        'maxDailyBotRepliesPerConv', v_plan.max_daily_bot_replies_per_conv,
        'historyRetentionDays', v_plan.history_retention_days,
        'allowedKnowledgeTypes', v_plan.allowed_knowledge_types,
        'dailyNewConversationsUsed', v_daily_new_convs,
        'dailyBotRepliesUsed', v_daily_bot_replies,
        'agentsCount', v_agents_count,
        'connectionsCount', v_connections_count,
        'subscriptionStatus', v_plan.subscription_status,
        'billingCycle', v_plan.billing_cycle,
        'currentPeriodEnd', v_plan.current_period_end
    );
END;
$$;
