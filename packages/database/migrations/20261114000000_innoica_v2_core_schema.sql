-- ====================================================================
-- INNOICA WhatsApp Agents v2.0 — Core Database Schema & RLS Policies
-- Date: 14 Novembre 2026
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAINS (if not already existing)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE agent_status AS ENUM ('draft', 'pending_connection', 'connected', 'active', 'paused', 'error', 'disconnected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_connection_status AS ENUM ('pending', 'pairing', 'connected', 'disconnected', 'error');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE control_mode_type AS ENUM ('ai_active', 'human_takeover', 'paused');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE sender_type_enum AS ENUM ('contact', 'agent', 'human');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE message_delivery_status AS ENUM ('received', 'queued', 'sent', 'delivered', 'read', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name_fr TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_fr TEXT,
    description_en TEXT,
    price_monthly_xaf NUMERIC NOT NULL DEFAULT 0,
    price_yearly_xaf NUMERIC NOT NULL DEFAULT 0,
    max_agents INTEGER NOT NULL DEFAULT 1,
    max_connections INTEGER NOT NULL DEFAULT 1,
    max_knowledge_docs INTEGER NOT NULL DEFAULT 3,
    features JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- 7. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'pending', 'active', 'past_due', 'expired', 'cancelled')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. AGENT TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name_fr TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_fr TEXT NOT NULL,
    description_en TEXT NOT NULL,
    default_system_prompt_fr TEXT NOT NULL,
    default_system_prompt_en TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Bot',
    category TEXT NOT NULL DEFAULT 'business',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AI CREDENTIALS TABLE (BYOK - Server-side AES encrypted)
CREATE TABLE IF NOT EXISTS public.ai_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'groq', 'gemini', 'openai')),
    label TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    key_hint TEXT NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. AGENTS TABLE
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.agent_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    primary_language TEXT NOT NULL DEFAULT 'fr' CHECK (primary_language IN ('fr', 'en')),
    system_prompt TEXT NOT NULL,
    personality_traits TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_connection', 'connected', 'active', 'paused', 'error', 'disconnected')),
    is_memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ai_credential_id UUID REFERENCES public.ai_credentials(id) ON DELETE SET NULL,
    ai_provider TEXT NOT NULL DEFAULT 'openrouter',
    ai_model TEXT NOT NULL DEFAULT 'meta-llama/llama-3.3-70b-instruct',
    ai_temperature NUMERIC NOT NULL DEFAULT 0.7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. WHATSAPP CONNECTIONS TABLE (1 Phone Number = 1 Agent)
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id UUID UNIQUE NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pairing', 'connected', 'disconnected', 'error')),
    pairing_code TEXT,
    pairing_code_expires_at TIMESTAMPTZ,
    last_connected_at TIMESTAMPTZ,
    disconnect_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. WHATSAPP SESSIONS TABLE (Worker-only auth state)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID UNIQUE NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
    encrypted_auth_state TEXT,
    session_version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. KNOWLEDGE SOURCES TABLE
CREATE TABLE IF NOT EXISTS public.agent_knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('faq', 'pdf', 'txt', 'url')),
    title TEXT NOT NULL,
    file_path TEXT,
    source_url TEXT,
    raw_content TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. KNOWLEDGE CHUNKS TABLE
CREATE TABLE IF NOT EXISTS public.agent_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.agent_knowledge_sources(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, phone_number)
);

-- 16. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    control_mode TEXT NOT NULL DEFAULT 'ai_active' CHECK (control_mode IN ('ai_active', 'human_takeover', 'paused')),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, contact_id)
);

-- 17. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    wa_message_id TEXT,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent', 'human')),
    content TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'received' CHECK (delivery_status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. CONTACT MEMORIES TABLE
CREATE TABLE IF NOT EXISTS public.contact_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contact_id, key)
);

-- 19. HUMAN HANDOFFS TABLE
CREATE TABLE IF NOT EXISTS public.human_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- 20. EXECUTION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_phone ON public.whatsapp_connections(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_phone ON public.contacts(workspace_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_contact ON public.conversations(agent_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_agent ON public.agent_knowledge_chunks(agent_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_workspace ON public.execution_logs(workspace_id, created_at DESC);

-- 23. ROW LEVEL SECURITY (RLS) POLICIES
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
ALTER TABLE public.human_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users read and update their own profile; Super admins can view all
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Plans: everyone can view active plans
CREATE POLICY "Public read active plans" ON public.plans
    FOR SELECT USING (is_active = TRUE);

-- Agent Templates: everyone can view active templates
CREATE POLICY "Public read active templates" ON public.agent_templates
    FOR SELECT USING (is_active = TRUE);

-- Helper function: check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
$$;

-- Workspaces: members can view their workspaces
CREATE POLICY "Members can view workspaces" ON public.workspaces
    FOR SELECT USING (public.is_workspace_member(id));

CREATE POLICY "Owners can update workspace" ON public.workspaces
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspace" ON public.workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Workspace Members
CREATE POLICY "Members can view workspace member list" ON public.workspace_members
    FOR SELECT USING (public.is_workspace_member(workspace_id));

-- Subscriptions
CREATE POLICY "Members can view workspace subscription" ON public.subscriptions
    FOR SELECT USING (public.is_workspace_member(workspace_id));

-- AI Credentials
CREATE POLICY "Members can view workspace ai credentials" ON public.ai_credentials
    FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert workspace ai credentials" ON public.ai_credentials
    FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update workspace ai credentials" ON public.ai_credentials
    FOR UPDATE USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete workspace ai credentials" ON public.ai_credentials
    FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Agents
CREATE POLICY "Members can view workspace agents" ON public.agents
    FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create workspace agents" ON public.agents
    FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update workspace agents" ON public.agents
    FOR UPDATE USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete workspace agents" ON public.agents
    FOR DELETE USING (public.is_workspace_member(workspace_id));

-- WhatsApp Connections
CREATE POLICY "Members can view workspace wa connections" ON public.whatsapp_connections
    FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert workspace wa connections" ON public.whatsapp_connections
    FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update workspace wa connections" ON public.whatsapp_connections
    FOR UPDATE USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete workspace wa connections" ON public.whatsapp_connections
    FOR DELETE USING (public.is_workspace_member(workspace_id));

-- WhatsApp Sessions (Workers / Service Role only; clients have NO direct select/update access)
-- No public user policy for whatsapp_sessions for maximum security.

-- Knowledge Sources
CREATE POLICY "Members can access knowledge sources" ON public.agent_knowledge_sources
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            WHERE a.id = agent_knowledge_sources.agent_id
            AND public.is_workspace_member(a.workspace_id)
        )
    );

-- Knowledge Chunks
CREATE POLICY "Members can access knowledge chunks" ON public.agent_knowledge_chunks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            WHERE a.id = agent_knowledge_chunks.agent_id
            AND public.is_workspace_member(a.workspace_id)
        )
    );

-- Contacts
CREATE POLICY "Members can view contacts" ON public.contacts
    FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can manage contacts" ON public.contacts
    FOR ALL USING (public.is_workspace_member(workspace_id));

-- Conversations
CREATE POLICY "Members can view conversations" ON public.conversations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            WHERE a.id = conversations.agent_id
            AND public.is_workspace_member(a.workspace_id)
        )
    );

-- Messages
CREATE POLICY "Members can access messages" ON public.messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.agents a ON a.id = c.agent_id
            WHERE c.id = messages.conversation_id
            AND public.is_workspace_member(a.workspace_id)
        )
    );

-- Contact Memories
CREATE POLICY "Members can access contact memories" ON public.contact_memories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.contacts ct
            WHERE ct.id = contact_memories.contact_id
            AND public.is_workspace_member(ct.workspace_id)
        )
    );

-- Execution Logs
CREATE POLICY "Members can view workspace execution logs" ON public.execution_logs
    FOR SELECT USING (public.is_workspace_member(workspace_id));
