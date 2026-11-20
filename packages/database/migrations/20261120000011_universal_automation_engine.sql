-- ====================================================================
-- INNOICA WhatsApp Agents v2.0 — Universal Automation Engine & Programmable Agents
-- Migration: 20261120000011_universal_automation_engine.sql
-- Adds: workflow versioning, DAG schemas, correlation IDs, approvals, webhooks, RLS
-- ====================================================================

-- 1. Workflow Definitions
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    domain TEXT NOT NULL DEFAULT 'general',
    natural_instruction TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    priority INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    is_active_version BOOLEAN NOT NULL DEFAULT true,
    parent_workflow_id UUID REFERENCES public.workflow_definitions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Workflow Executions
CREATE TABLE IF NOT EXISTS public.workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    correlation_id TEXT,
    expected_sender_phone TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    trigger_event TEXT NOT NULL,
    trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_step_index INTEGER NOT NULL DEFAULT 0,
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    waiting_context JSONB,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Workflow Execution Logs (step-by-step tracing)
CREATE TABLE IF NOT EXISTS public.workflow_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL,
    input_payload JSONB,
    output_payload JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Workflow Approvals (Human-in-the-Loop)
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

-- 5. Workflow Webhooks (Inbound HTTP Triggers)
CREATE TABLE IF NOT EXISTS public.workflow_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
    endpoint_token TEXT NOT NULL UNIQUE,
    secret_hash TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_called_at TIMESTAMPTZ
);

-- 6. WhatsApp Group Configurations
CREATE TABLE IF NOT EXISTS public.whatsapp_group_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    group_jid TEXT NOT NULL,
    group_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    monitor_mode TEXT NOT NULL DEFAULT 'smart_needed',
    keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
    custom_instructions TEXT,
    allow_admin_actions BOOLEAN NOT NULL DEFAULT false,
    allowed_participants TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_whatsapp_group_configs_agent_jid UNIQUE (agent_id, group_jid)
);

-- 7. WhatsApp Channel Configurations
CREATE TABLE IF NOT EXISTS public.whatsapp_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    channel_jid TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    auto_publish_enabled BOOLEAN NOT NULL DEFAULT false,
    require_human_approval BOOLEAN NOT NULL DEFAULT true,
    custom_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_whatsapp_channel_configs_agent_jid UNIQUE (agent_id, channel_jid)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_workflow_defs_workspace ON public.workflow_definitions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_defs_agent ON public.workflow_definitions(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_defs_trigger ON public.workflow_definitions(workspace_id, trigger_type, status);
CREATE INDEX IF NOT EXISTS idx_workflow_defs_versioning ON public.workflow_definitions(parent_workflow_id, version);

CREATE INDEX IF NOT EXISTS idx_workflow_execs_workspace ON public.workflow_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execs_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execs_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_execs_correlation ON public.workflow_executions(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_execs_waiting_phone ON public.workflow_executions(expected_sender_phone) WHERE expected_sender_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_execs_idempotency ON public.workflow_executions(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_logs_execution ON public.workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workspace ON public.workflow_approvals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_exec ON public.workflow_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON public.workflow_approvals(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_workflow_webhooks_token ON public.workflow_webhooks(endpoint_token);
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_agent ON public.whatsapp_group_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_agent ON public.whatsapp_channel_configs(agent_id);

-- UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS trg_workflow_defs_updated_at ON public.workflow_definitions;
CREATE TRIGGER trg_workflow_defs_updated_at BEFORE UPDATE ON public.workflow_definitions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_groups_updated_at ON public.whatsapp_group_configs;
CREATE TRIGGER trg_whatsapp_groups_updated_at BEFORE UPDATE ON public.whatsapp_group_configs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_channels_updated_at ON public.whatsapp_channel_configs;
CREATE TRIGGER trg_whatsapp_channels_updated_at BEFORE UPDATE ON public.whatsapp_channel_configs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_channel_configs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Members manage workflow_definitions" ON public.workflow_definitions;
DROP POLICY IF EXISTS "Members view workflow_executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Members view workflow_execution_logs" ON public.workflow_execution_logs;
DROP POLICY IF EXISTS "Members manage workflow_approvals" ON public.workflow_approvals;
DROP POLICY IF EXISTS "Members manage workflow_webhooks" ON public.workflow_webhooks;
DROP POLICY IF EXISTS "Members manage whatsapp_group_configs" ON public.whatsapp_group_configs;
DROP POLICY IF EXISTS "Members manage whatsapp_channel_configs" ON public.whatsapp_channel_configs;

CREATE POLICY "Members manage workflow_definitions" ON public.workflow_definitions
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members view workflow_executions" ON public.workflow_executions
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members view workflow_execution_logs" ON public.workflow_execution_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workflow_executions we
            WHERE we.id = workflow_execution_logs.execution_id
              AND public.is_workspace_member(we.workspace_id)
        )
    );

CREATE POLICY "Members manage workflow_approvals" ON public.workflow_approvals
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members manage workflow_webhooks" ON public.workflow_webhooks
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members manage whatsapp_group_configs" ON public.whatsapp_group_configs
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members manage whatsapp_channel_configs" ON public.whatsapp_channel_configs
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- GRANTS
GRANT ALL ON TABLE public.workflow_definitions TO authenticated, service_role;
GRANT ALL ON TABLE public.workflow_executions TO authenticated, service_role;
GRANT ALL ON TABLE public.workflow_execution_logs TO authenticated, service_role;
GRANT ALL ON TABLE public.workflow_approvals TO authenticated, service_role;
GRANT ALL ON TABLE public.workflow_webhooks TO authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_group_configs TO authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_channel_configs TO authenticated, service_role;
