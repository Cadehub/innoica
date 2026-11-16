-- ====================================================================
-- INNOICA Agent Studio — Native WhatsApp Voice Message Understanding
-- Migration 003: Plan Capabilities, Audio Metadata, Voice Processing Jobs
-- & Entitlement Enforcement RPCs
-- ====================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{"voice_message_understanding": false}'::jsonb;

UPDATE public.plans
SET capabilities = jsonb_set(
  COALESCE(capabilities, '{}'::jsonb),
  '{voice_message_understanding}',
  CASE WHEN slug = 'free' THEN 'false'::jsonb ELSE 'true'::jsonb END
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'audio')),
  ADD COLUMN IF NOT EXISTS voice_metadata JSONB DEFAULT NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS preferred_language TEXT
    CHECK (preferred_language IN ('fr', 'en') OR preferred_language IS NULL),
  ADD COLUMN IF NOT EXISTS clarification_state JSONB DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.voice_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  wa_message_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'blocked_free', 'transcribing', 'completed', 'failed')),
  mime_type TEXT,
  file_size_bytes INTEGER,
  duration_seconds NUMERIC(8, 2),
  detected_language TEXT,
  quality_category TEXT
    CHECK (quality_category IN ('high', 'partial', 'low', 'no_speech', 'unsupported', 'processing_error', 'blocked_free_plan') OR quality_category IS NULL),
  comprehension_status TEXT
    CHECK (comprehension_status IN ('sufficient', 'partial', 'insufficient', 'pending', 'blocked_free') OR comprehension_status IS NULL),
  processing_ms INTEGER,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_jobs_workspace_created
  ON public.voice_processing_jobs(workspace_id, created_at DESC);

ALTER TABLE public.voice_processing_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'voice_processing_jobs' AND policyname = 'voice_jobs_select_member_or_admin'
  ) THEN
    CREATE POLICY voice_jobs_select_member_or_admin ON public.voice_processing_jobs
      FOR SELECT
      USING (
        public.is_workspace_member(workspace_id) OR public.is_current_user_super_admin()
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_voice_entitlement(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_plan RECORD;
    v_raw_caps JSONB := '{}'::jsonb;
    v_voice_ok BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_plan FROM public.resolve_effective_workspace_plan(p_workspace_id);
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'planSlug', 'free',
            'hasVoiceUnderstanding', FALSE,
            'capabilities', jsonb_build_object('voice_message_understanding', FALSE)
        );
    END IF;

    SELECT COALESCE(capabilities, '{}'::jsonb) INTO v_raw_caps FROM public.plans WHERE id = v_plan.plan_id;

    IF v_plan.plan_slug <> 'free'
       AND COALESCE(v_plan.subscription_status, 'active') = 'active'
       AND (v_plan.current_period_end IS NULL OR v_plan.current_period_end > NOW()) THEN
        v_voice_ok := TRUE;
    ELSE
        v_voice_ok := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'planSlug', v_plan.plan_slug,
        'hasVoiceUnderstanding', v_voice_ok,
        'capabilities', jsonb_set(v_raw_caps, '{voice_message_understanding}', to_jsonb(v_voice_ok))
    );
END;
$function$;
