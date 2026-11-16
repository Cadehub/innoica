-- ====================================================================
-- INNOICA AGENT STUDIO — Plans (Free/Starter), Atomic Quotas,
-- RLS Hardening, Memories, Manual Payments & Worker RPCs
-- Date: 14 Novembre 2026
-- ====================================================================

-- 0. Schema privé interne (non exposé via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.worker_credentials (
    id TEXT PRIMARY KEY DEFAULT 'default',
    secret_sha256 TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON TABLE private.worker_credentials FROM PUBLIC;

-- 1. Extensions de base
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Mise à jour structurelle des plans, workspaces et conversations
ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS max_daily_new_conversations INTEGER,
    ADD COLUMN IF NOT EXISTS max_daily_bot_replies_per_conv INTEGER,
    ADD COLUMN IF NOT EXISTS history_retention_days INTEGER,
    ADD COLUMN IF NOT EXISTS has_watermark BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allowed_knowledge_types TEXT[] NOT NULL DEFAULT ARRAY['faq', 'txt']::TEXT[],
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.workspaces
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$ BEGIN
    ALTER TABLE public.workspaces
        ADD CONSTRAINT workspaces_status_check CHECK (status IN ('active', 'suspended'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT '';

-- 3. Table de configuration commerciale et watermark (administrable)
CREATE TABLE IF NOT EXISTS public.app_commercial_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    official_domain TEXT NOT NULL DEFAULT 'agents.innoica.com',
    watermark_template_fr TEXT NOT NULL DEFAULT 'Cet assistant fonctionne avec Innoica Agent Studio. Créez votre propre agent WhatsApp : {url}',
    watermark_template_en TEXT NOT NULL DEFAULT 'Powered by Innoica Agent Studio. Create your own WhatsApp agent: {url}',
    free_limit_notice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    free_limit_notice_fr TEXT NOT NULL DEFAULT 'Notre assistant automatique a atteint sa limite quotidienne. Un conseiller humain prendra le relais dès que possible.',
    free_limit_notice_en TEXT NOT NULL DEFAULT 'Our automated assistant has reached its daily limit. A human advisor will follow up shortly.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_commercial_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- 4. Mémoire par conversation (complète contact_memories)
CREATE TABLE IF NOT EXISTS public.conversation_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, key)
);

-- 5. Tables de quotas Free atomiques et auditables (Fuseau Africa/Douala)
CREATE TABLE IF NOT EXISTS public.daily_conversation_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, period_date, agent_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_daily_conv_claims_ws_date
    ON public.daily_conversation_claims(workspace_id, period_date);

CREATE TABLE IF NOT EXISTS public.quota_reply_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    period_date DATE NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'confirmed', 'released')),
    wa_message_id TEXT,
    release_reason TEXT,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quota_reply_res_conv_date_status
    ON public.quota_reply_reservations(conversation_id, period_date, status);
CREATE INDEX IF NOT EXISTS idx_quota_reply_res_ws_date_status
    ON public.quota_reply_reservations(workspace_id, period_date, status);

-- 6. Déclarations de paiement manuel (OM / MoMo / Carte) avec approbation Admin idempotente
CREATE TABLE IF NOT EXISTS public.payment_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    amount_xaf NUMERIC NOT NULL CHECK (amount_xaf > 0),
    payment_method TEXT NOT NULL,
    reference TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    proof_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_declarations_ws_created
    ON public.payment_declarations(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_declarations_status
    ON public.payment_declarations(status, created_at DESC);

-- 7. Seed / Mise à jour stricte des 2 offres officielles : FREE & STARTER uniquement
INSERT INTO public.plans (
    slug,
    name_fr,
    name_en,
    description_fr,
    description_en,
    price_monthly_xaf,
    price_yearly_xaf,
    max_agents,
    max_connections,
    max_knowledge_docs,
    max_daily_new_conversations,
    max_daily_bot_replies_per_conv,
    history_retention_days,
    has_watermark,
    allowed_knowledge_types,
    features,
    is_active,
    sort_order
)
VALUES
(
    'free',
    'Free',
    'Free',
    'Pour démarrer gratuitement avec 1 agent WhatsApp, BYOK et des quotas quotidiens encadrés.',
    'Start for free with 1 WhatsApp agent, BYOK, and daily starter limits.',
    0,
    0,
    1,
    1,
    3,
    5,
    10,
    7,
    TRUE,
    ARRAY['faq', 'txt']::TEXT[],
    '["1 Agent IA WhatsApp","1 Numéro WhatsApp connecté","5 nouvelles conversations / jour","10 réponses IA / conversation / jour","BYOK (OpenRouter, Groq, Gemini, OpenAI)","Connaissances (FAQ & TXT)","Historique 7 jours","Signature INNOICA sur réponses IA"]'::JSONB,
    TRUE,
    1
),
(
    'starter',
    'Starter',
    'Starter',
    'Offre complète pour entreprises et pros : 2 agents, quotas plateforme illimités et zéro signature.',
    'Full package for businesses & pros: 2 agents, no INNOICA daily caps, and no watermark.',
    5000,
    54000,
    2,
    2,
    25,
    NULL,
    NULL,
    NULL,
    FALSE,
    ARRAY['faq', 'txt', 'pdf', 'url']::TEXT[],
    '["Jusqu''à 2 Agents IA WhatsApp","Jusqu''à 2 Numéros WhatsApp connectés","Conversations quotidiennes illimitées côté plateforme","Réponses IA quotidiennes illimitées côté plateforme","FAQ, Import PDF, TXT et URL publique","Mémoire durable contact & conversation","Inbox temps réel & Human Takeover","Historique étendu & sans signature INNOICA"]'::JSONB,
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
    max_daily_new_conversations = EXCLUDED.max_daily_new_conversations,
    max_daily_bot_replies_per_conv = EXCLUDED.max_daily_bot_replies_per_conv,
    history_retention_days = EXCLUDED.history_retention_days,
    has_watermark = EXCLUDED.has_watermark,
    allowed_knowledge_types = EXCLUDED.allowed_knowledge_types,
    features = EXCLUDED.features,
    is_active = TRUE,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Migration douce des données existantes Pro/Enterprise vers Starter sans suppression
DO $$
DECLARE
    v_free_id UUID;
    v_starter_id UUID;
BEGIN
    SELECT id INTO v_free_id FROM public.plans WHERE slug = 'free';
    SELECT id INTO v_starter_id FROM public.plans WHERE slug = 'starter';

    -- Désactiver les anciens plans Pro / Enterprise sans casser les FK historiques
    UPDATE public.plans
    SET is_active = FALSE, updated_at = NOW()
    WHERE slug NOT IN ('free', 'starter');

    -- Migrer les workspaces et abonnements Pro/Enterprise existants vers Starter
    IF v_starter_id IS NOT NULL THEN
        UPDATE public.workspaces w
        SET plan_id = v_starter_id, updated_at = NOW()
        FROM public.plans p
        WHERE w.plan_id = p.id AND p.slug NOT IN ('free', 'starter');

        UPDATE public.subscriptions s
        SET plan_id = v_starter_id, updated_at = NOW()
        FROM public.plans p
        WHERE s.plan_id = p.id AND p.slug NOT IN ('free', 'starter');
    END IF;

    -- Assigner Free aux workspaces sans plan ou sans abonnement
    IF v_free_id IS NOT NULL THEN
        UPDATE public.workspaces
        SET plan_id = v_free_id, updated_at = NOW()
        WHERE plan_id IS NULL;

        INSERT INTO public.subscriptions (workspace_id, plan_id, billing_cycle, status, current_period_start, current_period_end)
        SELECT w.id, COALESCE(w.plan_id, v_free_id), 'monthly', 'active', NOW(), NOW() + INTERVAL '3650 days'
        FROM public.workspaces w
        WHERE NOT EXISTS (
            SELECT 1 FROM public.subscriptions s WHERE s.workspace_id = w.id
        );
    END IF;
END $$;

-- 8. Activation stricte du Row Level Security (RLS) sur TOUTES les tables Innoica
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_commercial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_conversation_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_reply_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_declarations ENABLE ROW LEVEL SECURITY;

-- 9. Fonctions utilitaires de sécurité et fuseau Africa/Douala
CREATE OR REPLACE FUNCTION public.current_douala_date()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT (NOW() AT TIME ZONE 'Africa/Douala')::DATE;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_super_admin = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
$$;

-- Empêcher toute élévation de privilèges vers is_super_admin via l'API client
CREATE OR REPLACE FUNCTION private.prevent_super_admin_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF current_setting('request.jwt.claim.role', true) = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.is_super_admin := FALSE;
    ELSIF TG_OP = 'UPDATE' AND NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
        IF NOT public.is_current_user_super_admin() THEN
            RAISE EXCEPTION 'Modification du statut super administrateur interdite';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_super_admin_self_escalation
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.prevent_super_admin_self_escalation();

-- Autorisation stricte des workers Node.js (service_role OU secret serveur haché en base)
CREATE OR REPLACE FUNCTION private.is_authorized_worker(p_worker_secret TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, private
AS $$
DECLARE
    v_stored_hash TEXT;
    v_computed_hash TEXT;
BEGIN
    IF current_setting('request.jwt.claim.role', true) = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN TRUE;
    END IF;

    IF p_worker_secret IS NULL OR length(trim(p_worker_secret)) < 16 THEN
        RETURN FALSE;
    END IF;

    SELECT secret_sha256 INTO v_stored_hash
    FROM private.worker_credentials
    WHERE id = 'default';

    IF v_stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    v_computed_hash := encode(extensions.digest(p_worker_secret, 'sha256'), 'hex');
    RETURN v_computed_hash = v_stored_hash;
END;
$$;

-- 10. Politiques RLS complémentaires (Workspace + Super Admin + Tables nouvelles)
DO $$ BEGIN
    CREATE POLICY "Super admins can view all profiles" ON public.profiles
        FOR SELECT USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Owners can add own workspace membership" ON public.workspace_members
        FOR INSERT WITH CHECK (
            user_id = auth.uid()
            AND role = 'owner'
            AND EXISTS (
                SELECT 1 FROM public.workspaces w
                WHERE w.id = workspace_id AND w.owner_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can view all workspaces" ON public.workspaces
        FOR SELECT USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can update workspaces" ON public.workspaces
        FOR UPDATE USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can view all subscriptions" ON public.subscriptions
        FOR SELECT USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can view all agents" ON public.agents
        FOR SELECT USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can update agents" ON public.agents
        FOR UPDATE USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can view all wa connections" ON public.whatsapp_connections
        FOR SELECT USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can view all execution logs" ON public.execution_logs
        FOR SELECT USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members or super admin can view audit logs" ON public.audit_logs
        FOR SELECT USING (public.is_workspace_member(workspace_id) OR public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admins can manage plans" ON public.plans
        FOR ALL USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can access conversation memories" ON public.conversation_memories
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.conversations c
                JOIN public.agents a ON a.id = c.agent_id
                WHERE c.id = conversation_memories.conversation_id
                AND public.is_workspace_member(a.workspace_id)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can access human handoffs" ON public.human_handoffs
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.conversations c
                JOIN public.agents a ON a.id = c.agent_id
                WHERE c.id = human_handoffs.conversation_id
                AND public.is_workspace_member(a.workspace_id)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can view daily conv claims" ON public.daily_conversation_claims
        FOR SELECT USING (public.is_workspace_member(workspace_id) OR public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can view reply quota reservations" ON public.quota_reply_reservations
        FOR SELECT USING (public.is_workspace_member(workspace_id) OR public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can view workspace payments" ON public.payment_declarations
        FOR SELECT USING (public.is_workspace_member(workspace_id) OR public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can submit pending payments" ON public.payment_declarations
        FOR INSERT WITH CHECK (
            public.is_workspace_member(workspace_id)
            AND submitted_by = auth.uid()
            AND status = 'pending'
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read commercial settings" ON public.app_commercial_settings
        FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Super admin update commercial settings" ON public.app_commercial_settings
        FOR UPDATE USING (public.is_current_user_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11. Fonction utilitaire de résolution du plan effectif d'un workspace (Free si Starter expiré)
CREATE OR REPLACE FUNCTION public.resolve_effective_workspace_plan(p_workspace_id UUID)
RETURNS TABLE (
    workspace_id UUID,
    workspace_status TEXT,
    plan_id UUID,
    plan_slug TEXT,
    subscription_status TEXT,
    billing_cycle TEXT,
    current_period_end TIMESTAMPTZ,
    max_agents INTEGER,
    max_connections INTEGER,
    max_knowledge_docs INTEGER,
    max_daily_new_conversations INTEGER,
    max_daily_bot_replies_per_conv INTEGER,
    history_retention_days INTEGER,
    has_watermark BOOLEAN,
    allowed_knowledge_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_ws RECORD;
    v_sub RECORD;
    v_plan RECORD;
    v_free_plan RECORD;
BEGIN
    SELECT w.id, w.status, w.plan_id INTO v_ws
    FROM public.workspaces w WHERE w.id = p_workspace_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT * INTO v_free_plan FROM public.plans WHERE slug = 'free' LIMIT 1;

    SELECT s.* INTO v_sub
    FROM public.subscriptions s
    WHERE s.workspace_id = p_workspace_id
    LIMIT 1;

    -- Un abonnement Starter n'est actif que si status='active' et période non expirée
    IF v_sub IS NOT NULL AND v_sub.status = 'active' AND v_sub.current_period_end > NOW() THEN
        SELECT * INTO v_plan FROM public.plans WHERE id = v_sub.plan_id;
    ELSIF v_ws.plan_id IS NOT NULL THEN
        SELECT * INTO v_plan FROM public.plans WHERE id = v_ws.plan_id;
        -- Si le workspace pointait sur starter mais son abonnement est expiré/annulé/suspendu -> rétrograde effectif vers Free
        IF v_plan.slug = 'starter' AND v_sub IS NOT NULL AND (v_sub.status NOT IN ('active', 'trial') OR v_sub.current_period_end <= NOW()) THEN
            v_plan := v_free_plan;
        END IF;
    ELSE
        v_plan := v_free_plan;
    END IF;

    IF v_plan IS NULL THEN
        v_plan := v_free_plan;
    END IF;

    RETURN QUERY SELECT
        v_ws.id,
        v_ws.status,
        v_plan.id,
        v_plan.slug,
        COALESCE(v_sub.status, 'active')::TEXT,
        COALESCE(v_sub.billing_cycle, 'monthly')::TEXT,
        v_sub.current_period_end,
        v_plan.max_agents,
        v_plan.max_connections,
        v_plan.max_knowledge_docs,
        v_plan.max_daily_new_conversations,
        v_plan.max_daily_bot_replies_per_conv,
        v_plan.history_retention_days,
        v_plan.has_watermark,
        v_plan.allowed_knowledge_types;
END;
$$;

-- 12. Snapshot complet des quotas côté frontend/API (appelé par l'utilisateur authentifié membre)
CREATE OR REPLACE FUNCTION public.get_workspace_quota_snapshot(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_today DATE := public.current_douala_date();
    v_daily_new_convs INTEGER := 0;
    v_daily_bot_replies INTEGER := 0;
    v_agents_count INTEGER := 0;
    v_connections_count INTEGER := 0;
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

-- 13. Bootstrap Workspace lors de l'inscription (assigne le plan Free atomiquement)
CREATE OR REPLACE FUNCTION public.bootstrap_user_workspace(p_full_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_ws_id UUID;
    v_free_plan_id UUID;
    v_slug TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentification requise';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    INSERT INTO public.profiles (id, email, full_name, is_super_admin)
    VALUES (v_uid, COALESCE(v_email, ''), p_full_name, FALSE)
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();

    -- Vérifier si un workspace existe déjà pour ce membre
    SELECT workspace_id INTO v_ws_id
    FROM public.workspace_members
    WHERE user_id = v_uid
    LIMIT 1;

    SELECT id INTO v_free_plan_id FROM public.plans WHERE slug = 'free' LIMIT 1;

    IF v_ws_id IS NULL THEN
        v_slug := 'ws-' || substr(replace(v_uid::TEXT, '-', ''), 1, 12);
        INSERT INTO public.workspaces (name, slug, owner_id, plan_id)
        VALUES (
            'Workspace de ' || COALESCE(NULLIF(trim(p_full_name), ''), split_part(COALESCE(v_email, 'utilisateur'), '@', 1)),
            v_slug,
            v_uid,
            v_free_plan_id
        )
        RETURNING id INTO v_ws_id;

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (v_ws_id, v_uid, 'owner')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;

        IF v_free_plan_id IS NOT NULL THEN
            INSERT INTO public.subscriptions (workspace_id, plan_id, billing_cycle, status, current_period_start, current_period_end)
            VALUES (v_ws_id, v_free_plan_id, 'monthly', 'active', NOW(), NOW() + INTERVAL '3650 days')
            ON CONFLICT (workspace_id) DO NOTHING;
        END IF;
    END IF;

    RETURN jsonb_build_object('workspaceId', v_ws_id, 'planSlug', 'free');
END;
$$;

-- 14. Réservation atomique de quota IA (idempotente & résistante à la concurrence)
CREATE OR REPLACE FUNCTION public.reserve_ai_reply_quota(
    p_workspace_id UUID,
    p_agent_id UUID,
    p_conversation_id UUID,
    p_contact_phone TEXT,
    p_idempotency_key TEXT,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_today DATE := public.current_douala_date();
    v_plan RECORD;
    v_existing RECORD;
    v_conv RECORD;
    v_conv_created_douala DATE;
    v_claim_exists BOOLEAN := FALSE;
    v_daily_new_convs INTEGER := 0;
    v_conv_replies INTEGER := 0;
    v_clean_phone TEXT := regexp_replace(coalesce(p_contact_phone, ''), '[^0-9+@lid.]', '', 'g');
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    -- Verrou transactionnel par workspace + jour Africa/Douala pour éviter toute race condition
    PERFORM pg_advisory_xact_lock(hashtext('quota:' || p_workspace_id::TEXT || ':' || v_today::TEXT));

    SELECT * INTO v_plan FROM public.resolve_effective_workspace_plan(p_workspace_id);
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', FALSE, 'reason', 'workspace_not_found');
    END IF;

    IF v_plan.workspace_status = 'suspended' THEN
        RETURN jsonb_build_object('allowed', FALSE, 'reason', 'workspace_suspended', 'planSlug', v_plan.plan_slug);
    END IF;

    -- Idempotence : si la clé existe déjà en reserved ou confirmed, retourner le même état sans double comptage
    SELECT * INTO v_existing
    FROM public.quota_reply_reservations
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND AND v_existing.status IN ('reserved', 'confirmed') THEN
        SELECT COUNT(*) INTO v_daily_new_convs
        FROM public.daily_conversation_claims
        WHERE workspace_id = p_workspace_id AND period_date = v_today;

        SELECT COUNT(*) INTO v_conv_replies
        FROM public.quota_reply_reservations
        WHERE conversation_id = p_conversation_id AND period_date = v_today AND status IN ('reserved', 'confirmed');

        RETURN jsonb_build_object(
            'allowed', TRUE,
            'idempotent', TRUE,
            'reservationId', v_existing.id,
            'planSlug', v_plan.plan_slug,
            'hasWatermark', v_plan.has_watermark,
            'periodDate', v_today::TEXT,
            'usedNewConversations', v_daily_new_convs,
            'maxNewConversations', v_plan.max_daily_new_conversations,
            'usedConvReplies', v_conv_replies,
            'maxConvReplies', v_plan.max_daily_bot_replies_per_conv
        );
    END IF;

    SELECT created_at INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    v_conv_created_douala := (COALESCE(v_conv.created_at, NOW()) AT TIME ZONE 'Africa/Douala')::DATE;

    -- Vérifier le quota journalier de NOUVELLES conversations (Free: 5/jour Africa/Douala)
    -- Une conversation créée un jour précédent qui reprend aujourd'hui NE consomme pas une nouvelle conversation du jour.
    IF v_plan.max_daily_new_conversations IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.daily_conversation_claims
            WHERE workspace_id = p_workspace_id
              AND period_date = v_today
              AND agent_id = p_agent_id
              AND contact_phone = v_clean_phone
        ) INTO v_claim_exists;

        IF NOT v_claim_exists AND v_conv_created_douala = v_today THEN
            SELECT COUNT(*) INTO v_daily_new_convs
            FROM public.daily_conversation_claims
            WHERE workspace_id = p_workspace_id AND period_date = v_today;

            IF v_daily_new_convs >= v_plan.max_daily_new_conversations THEN
                RETURN jsonb_build_object(
                    'allowed', FALSE,
                    'reason', 'daily_new_conversations_quota_reached',
                    'planSlug', v_plan.plan_slug,
                    'hasWatermark', v_plan.has_watermark,
                    'periodDate', v_today::TEXT,
                    'usedNewConversations', v_daily_new_convs,
                    'maxNewConversations', v_plan.max_daily_new_conversations
                );
            END IF;

            INSERT INTO public.daily_conversation_claims (workspace_id, period_date, agent_id, contact_phone, conversation_id)
            VALUES (p_workspace_id, v_today, p_agent_id, v_clean_phone, p_conversation_id)
            ON CONFLICT (workspace_id, period_date, agent_id, contact_phone) DO NOTHING;
        END IF;
    END IF;

    -- Vérifier le quota journalier de RÉPONSES BOT par conversation (Free: 10/conv/jour Africa/Douala)
    SELECT COUNT(*) INTO v_conv_replies
    FROM public.quota_reply_reservations
    WHERE conversation_id = p_conversation_id
      AND period_date = v_today
      AND status IN ('reserved', 'confirmed');

    IF v_plan.max_daily_bot_replies_per_conv IS NOT NULL
       AND v_conv_replies >= v_plan.max_daily_bot_replies_per_conv THEN
        SELECT COUNT(*) INTO v_daily_new_convs
        FROM public.daily_conversation_claims
        WHERE workspace_id = p_workspace_id AND period_date = v_today;

        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'daily_conversation_replies_quota_reached',
            'planSlug', v_plan.plan_slug,
            'hasWatermark', v_plan.has_watermark,
            'periodDate', v_today::TEXT,
            'usedNewConversations', v_daily_new_convs,
            'maxNewConversations', v_plan.max_daily_new_conversations,
            'usedConvReplies', v_conv_replies,
            'maxConvReplies', v_plan.max_daily_bot_replies_per_conv
        );
    END IF;

    -- Réserver le créneau de réponse AVANT l'appel coûteux au LLM
    INSERT INTO public.quota_reply_reservations (
        workspace_id, agent_id, conversation_id, contact_phone, period_date, idempotency_key, status
    )
    VALUES (
        p_workspace_id, p_agent_id, p_conversation_id, v_clean_phone, v_today, p_idempotency_key, 'reserved'
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET
        status = CASE
            WHEN public.quota_reply_reservations.status = 'released' THEN 'reserved'
            ELSE public.quota_reply_reservations.status
        END,
        release_reason = NULL,
        released_at = NULL
    RETURNING * INTO v_existing;

    SELECT COUNT(*) INTO v_daily_new_convs
    FROM public.daily_conversation_claims
    WHERE workspace_id = p_workspace_id AND period_date = v_today;

    SELECT COUNT(*) INTO v_conv_replies
    FROM public.quota_reply_reservations
    WHERE conversation_id = p_conversation_id AND period_date = v_today AND status IN ('reserved', 'confirmed');

    RETURN jsonb_build_object(
        'allowed', TRUE,
        'idempotent', FALSE,
        'reservationId', v_existing.id,
        'planSlug', v_plan.plan_slug,
        'hasWatermark', v_plan.has_watermark,
        'periodDate', v_today::TEXT,
        'usedNewConversations', v_daily_new_convs,
        'maxNewConversations', v_plan.max_daily_new_conversations,
        'usedConvReplies', v_conv_replies,
        'maxConvReplies', v_plan.max_daily_bot_replies_per_conv
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_ai_reply_quota(
    p_idempotency_key TEXT,
    p_wa_message_id TEXT DEFAULT NULL,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    UPDATE public.quota_reply_reservations
    SET
        status = 'confirmed',
        wa_message_id = COALESCE(p_wa_message_id, wa_message_id),
        confirmed_at = COALESCE(confirmed_at, NOW())
    WHERE idempotency_key = p_idempotency_key
      AND status IN ('reserved', 'confirmed');

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_reply_quota(
    p_idempotency_key TEXT,
    p_reason TEXT DEFAULT 'dispatch_aborted',
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    UPDATE public.quota_reply_reservations
    SET
        status = 'released',
        release_reason = p_reason,
        released_at = NOW()
    WHERE idempotency_key = p_idempotency_key
      AND status = 'reserved';

    RETURN FOUND;
END;
$$;

-- 15. Approbation / Rejet idempotent d'une déclaration de paiement Starter par un Super Admin
CREATE OR REPLACE FUNCTION public.review_payment_declaration(
    p_declaration_id UUID,
    p_decision TEXT,
    p_review_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_decl RECORD;
    v_interval INTERVAL;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF v_admin_id IS NULL OR NOT public.is_current_user_super_admin() THEN
        RAISE EXCEPTION 'Accès Super Admin requis';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Décision invalide';
    END IF;

    SELECT * INTO v_decl
    FROM public.payment_declarations
    WHERE id = p_declaration_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'declaration_not_found');
    END IF;

    -- Idempotence : si déjà traité, retourner sans réappliquer de période supplémentaire
    IF v_decl.status <> 'pending' THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'idempotent', TRUE,
            'status', v_decl.status,
            'declarationId', v_decl.id
        );
    END IF;

    UPDATE public.payment_declarations
    SET
        status = p_decision,
        reviewed_by = v_admin_id,
        reviewed_at = v_now,
        review_note = p_review_note
    WHERE id = p_declaration_id;

    IF p_decision = 'approved' THEN
        v_interval := CASE
            WHEN v_decl.billing_cycle = 'yearly' THEN INTERVAL '365 days'
            ELSE INTERVAL '30 days'
        END;

        UPDATE public.workspaces
        SET plan_id = v_decl.plan_id, updated_at = v_now
        WHERE id = v_decl.workspace_id;

        INSERT INTO public.subscriptions (
            workspace_id, plan_id, billing_cycle, status, current_period_start, current_period_end, updated_at
        )
        VALUES (
            v_decl.workspace_id, v_decl.plan_id, v_decl.billing_cycle, 'active', v_now, v_now + v_interval, v_now
        )
        ON CONFLICT (workspace_id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            billing_cycle = EXCLUDED.billing_cycle,
            status = 'active',
            current_period_start = CASE
                WHEN public.subscriptions.status = 'active'
                     AND public.subscriptions.plan_id = EXCLUDED.plan_id
                     AND public.subscriptions.current_period_end > v_now
                THEN public.subscriptions.current_period_start
                ELSE v_now
            END,
            current_period_end = CASE
                WHEN public.subscriptions.status = 'active'
                     AND public.subscriptions.plan_id = EXCLUDED.plan_id
                     AND public.subscriptions.current_period_end > v_now
                THEN public.subscriptions.current_period_end + v_interval
                ELSE v_now + v_interval
            END,
            updated_at = v_now;
    END IF;

    INSERT INTO public.audit_logs (workspace_id, user_id, action, target_type, target_id, metadata)
    VALUES (
        v_decl.workspace_id,
        v_admin_id,
        'payment_declaration_' || p_decision,
        'payment_declaration',
        v_decl.id::TEXT,
        jsonb_build_object(
            'amount_xaf', v_decl.amount_xaf,
            'billing_cycle', v_decl.billing_cycle,
            'reference', v_decl.reference,
            'review_note', p_review_note
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'idempotent', FALSE,
        'status', p_decision,
        'declarationId', v_decl.id
    );
END;
$$;

-- 16. RPCs sécurisées des Workers WhatsApp & AI Runtime (compatibles RLS + sans exposition client)
CREATE OR REPLACE FUNCTION public.worker_ingest_inbound_message(
    p_agent_id UUID,
    p_contact_phone TEXT,
    p_push_name TEXT,
    p_wa_message_id TEXT,
    p_content TEXT,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_agent RECORD;
    v_contact_id UUID;
    v_conv RECORD;
    v_existing_msg UUID;
    v_msg_id UUID;
    v_is_new_conv BOOLEAN := FALSE;
    v_today DATE := public.current_douala_date();
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    SELECT id, workspace_id, status, is_memory_enabled, primary_language
    INTO v_agent
    FROM public.agents
    WHERE id = p_agent_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'agent_not_found');
    END IF;

    IF p_wa_message_id IS NOT NULL AND p_wa_message_id <> '' THEN
        SELECT id INTO v_existing_msg
        FROM public.messages
        WHERE wa_message_id = p_wa_message_id
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'duplicate_message');
        END IF;
    END IF;

    SELECT id, display_name INTO v_contact_id
    FROM public.contacts
    WHERE workspace_id = v_agent.workspace_id AND phone_number = p_contact_phone
    LIMIT 1;

    IF v_contact_id IS NULL THEN
        INSERT INTO public.contacts (workspace_id, phone_number, display_name)
        VALUES (v_agent.workspace_id, p_contact_phone, COALESCE(NULLIF(trim(p_push_name), ''), p_contact_phone))
        ON CONFLICT (workspace_id, phone_number) DO UPDATE SET
            display_name = COALESCE(NULLIF(public.contacts.display_name, ''), EXCLUDED.display_name),
            updated_at = NOW()
        RETURNING id INTO v_contact_id;
    END IF;

    SELECT id, control_mode, unread_count, created_at INTO v_conv
    FROM public.conversations
    WHERE agent_id = p_agent_id AND contact_id = v_contact_id
    LIMIT 1;

    IF v_conv IS NULL THEN
        v_is_new_conv := TRUE;
        INSERT INTO public.conversations (agent_id, contact_id, control_mode, last_message_at, unread_count)
        VALUES (p_agent_id, v_contact_id, 'ai_active', NOW(), 1)
        ON CONFLICT (agent_id, contact_id) DO UPDATE SET
            last_message_at = NOW(),
            unread_count = public.conversations.unread_count + 1,
            updated_at = NOW()
        RETURNING id, control_mode, unread_count, created_at INTO v_conv;
    ELSE
        UPDATE public.conversations
        SET
            last_message_at = NOW(),
            unread_count = COALESCE(unread_count, 0) + 1,
            updated_at = NOW()
        WHERE id = v_conv.id
        RETURNING id, control_mode, unread_count, created_at INTO v_conv;
    END IF;

    INSERT INTO public.messages (conversation_id, wa_message_id, sender_type, content, delivery_status)
    VALUES (v_conv.id, NULLIF(p_wa_message_id, ''), 'contact', p_content, 'received')
    RETURNING id INTO v_msg_id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'workspaceId', v_agent.workspace_id,
        'agentStatus', v_agent.status,
        'conversationId', v_conv.id,
        'contactId', v_contact_id,
        'controlMode', v_conv.control_mode,
        'messageId', v_msg_id,
        'isNewConversation', v_is_new_conv,
        'todayDouala', v_today::TEXT
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_get_ai_context(
    p_agent_id UUID,
    p_conversation_id UUID,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_agent RECORD;
    v_conv RECORD;
    v_cred RECORD;
    v_plan RECORD;
    v_settings RECORD;
    v_contact_memories JSONB;
    v_conv_memories JSONB;
    v_knowledge JSONB;
    v_messages JSONB;
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    SELECT * INTO v_agent FROM public.agents WHERE id = p_agent_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'agent_not_found');
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'conversation_not_found');
    END IF;

    SELECT * INTO v_plan FROM public.resolve_effective_workspace_plan(v_agent.workspace_id);
    SELECT * INTO v_settings FROM public.app_commercial_settings WHERE id = 'default';

    IF v_agent.ai_credential_id IS NOT NULL THEN
        SELECT id, provider, encrypted_api_key INTO v_cred
        FROM public.ai_credentials WHERE id = v_agent.ai_credential_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', cm.key, 'value', cm.value)), '[]'::jsonb)
    INTO v_contact_memories
    FROM public.contact_memories cm
    WHERE cm.contact_id = v_conv.contact_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', cvm.key, 'value', cvm.value)), '[]'::jsonb)
    INTO v_conv_memories
    FROM public.conversation_memories cvm
    WHERE cvm.conversation_id = p_conversation_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('content', kc.content)), '[]'::jsonb)
    INTO v_knowledge
    FROM (
        SELECT content FROM public.agent_knowledge_chunks
        WHERE agent_id = p_agent_id
        ORDER BY chunk_index ASC
        LIMIT 8
    ) kc;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('sender_type', m.sender_type, 'content', m.content) ORDER BY m.created_at ASC), '[]'::jsonb)
    INTO v_messages
    FROM (
        SELECT sender_type, content, created_at
        FROM public.messages
        WHERE conversation_id = p_conversation_id
        ORDER BY created_at DESC
        LIMIT 8
    ) m;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'agent', row_to_json(v_agent),
        'conversation', row_to_json(v_conv),
        'credential', CASE WHEN v_cred IS NOT NULL THEN row_to_json(v_cred) ELSE NULL END,
        'plan', row_to_json(v_plan),
        'settings', row_to_json(v_settings),
        'contactMemories', v_contact_memories,
        'conversationMemories', v_conv_memories,
        'knowledgeChunks', v_knowledge,
        'recentMessages', v_messages
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_check_control_mode(
    p_conversation_id UUID,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_mode TEXT;
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    SELECT control_mode INTO v_mode
    FROM public.conversations
    WHERE id = p_conversation_id;

    RETURN v_mode;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_record_outbound_message(
    p_conversation_id UUID,
    p_wa_message_id TEXT,
    p_content TEXT,
    p_sender_type TEXT DEFAULT 'agent',
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_msg_id UUID;
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    INSERT INTO public.messages (conversation_id, wa_message_id, sender_type, content, delivery_status)
    VALUES (p_conversation_id, NULLIF(p_wa_message_id, ''), p_sender_type, p_content, 'sent')
    RETURNING id INTO v_msg_id;

    UPDATE public.conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = p_conversation_id;

    RETURN v_msg_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_upsert_memories(
    p_contact_id UUID,
    p_conversation_id UUID,
    p_contact_items JSONB DEFAULT '[]'::JSONB,
    p_conversation_items JSONB DEFAULT '[]'::JSONB,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_item JSONB;
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_contact_items, '[]'::jsonb))
    LOOP
        IF length(trim(coalesce(v_item->>'key', ''))) > 0 AND length(trim(coalesce(v_item->>'value', ''))) > 0 THEN
            INSERT INTO public.contact_memories (contact_id, key, value, confidence, updated_at)
            VALUES (p_contact_id, left(trim(v_item->>'key'), 80), left(trim(v_item->>'value'), 500), 0.9, NOW())
            ON CONFLICT (contact_id, key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW();
        END IF;
    END LOOP;

    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_conversation_items, '[]'::jsonb))
    LOOP
        IF length(trim(coalesce(v_item->>'key', ''))) > 0 AND length(trim(coalesce(v_item->>'value', ''))) > 0 THEN
            INSERT INTO public.conversation_memories (conversation_id, key, value, confidence, updated_at)
            VALUES (p_conversation_id, left(trim(v_item->>'key'), 80), left(trim(v_item->>'value'), 500), 0.9, NOW())
            ON CONFLICT (conversation_id, key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW();
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_log_execution(
    p_workspace_id UUID,
    p_agent_id UUID,
    p_level TEXT,
    p_event_type TEXT,
    p_message TEXT,
    p_details JSONB DEFAULT '{}'::JSONB,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    INSERT INTO public.execution_logs (workspace_id, agent_id, level, event_type, message, details)
    VALUES (p_workspace_id, p_agent_id, p_level, p_event_type, p_message, coalesce(p_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_update_wa_status(
    p_agent_id UUID,
    p_status TEXT,
    p_pairing_code TEXT DEFAULT NULL,
    p_pairing_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    UPDATE public.whatsapp_connections
    SET
        status = p_status,
        pairing_code = CASE
            WHEN p_status = 'connected' THEN NULL
            WHEN p_pairing_code IS NOT NULL THEN p_pairing_code
            ELSE pairing_code
        END,
        pairing_code_expires_at = CASE
            WHEN p_status = 'connected' THEN NULL
            WHEN p_pairing_expires_at IS NOT NULL THEN p_pairing_expires_at
            ELSE pairing_code_expires_at
        END,
        last_connected_at = CASE WHEN p_status = 'connected' THEN NOW() ELSE last_connected_at END,
        disconnect_reason = CASE WHEN p_reason IS NOT NULL THEN p_reason ELSE disconnect_reason END,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    IF p_status = 'connected' THEN
        UPDATE public.agents
        SET status = 'active', updated_at = NOW()
        WHERE id = p_agent_id AND status <> 'paused';
    ELSIF p_status = 'disconnected' THEN
        UPDATE public.agents
        SET status = 'disconnected', updated_at = NOW()
        WHERE id = p_agent_id;
    END IF;
END;
$$;

-- 17. RPC Super Admin : modification manuelle du forfait d'un workspace (Free <-> Starter)
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

    IF p_plan_slug NOT IN ('free', 'starter') THEN
        RAISE EXCEPTION 'Offre non autorisée : uniquement free ou starter';
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

    INSERT INTO public.audit_logs (workspace_id, user_id, action, target_type, target_id, metadata)
    VALUES (
        p_workspace_id,
        v_admin_id,
        'admin_set_workspace_plan',
        'workspace',
        p_workspace_id::TEXT,
        jsonb_build_object('plan_slug', p_plan_slug, 'billing_cycle', p_billing_cycle, 'duration_days', v_days)
    );

    RETURN jsonb_build_object('success', TRUE, 'workspaceId', p_workspace_id, 'planSlug', p_plan_slug);
END;
$$;

-- 18. Publication Supabase Realtime pour les mises à jour Inbox & Statuts
DO $$
DECLARE
    v_tbl TEXT;
BEGIN
    FOREACH v_tbl IN ARRAY ARRAY['conversations', 'messages', 'whatsapp_connections', 'payment_declarations', 'agents', 'execution_logs']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
        END IF;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

