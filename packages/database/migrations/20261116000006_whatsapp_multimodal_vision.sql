-- ====================================================================
-- INNOICA WhatsApp Agents v2.0 — WhatsApp Multimodal Vision Migration
-- Migration 006: Message Type 'image', image_metadata column,
-- and updated worker_ingest_inbound_message RPC
-- ====================================================================

-- 1. Ensure messages table supports 'image' message type and image_metadata JSONB
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'audio', 'image'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_metadata JSONB DEFAULT NULL;

-- 2. Drop 6-parameter worker_ingest_inbound_message to prevent function overloading ambiguity
DROP FUNCTION IF EXISTS public.worker_ingest_inbound_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 3. Create updated worker_ingest_inbound_message supporting p_message_type and p_image_metadata
CREATE OR REPLACE FUNCTION public.worker_ingest_inbound_message(
    p_agent_id UUID,
    p_contact_phone TEXT,
    p_push_name TEXT,
    p_wa_message_id TEXT,
    p_content TEXT,
    p_worker_secret TEXT DEFAULT NULL,
    p_message_type TEXT DEFAULT 'text',
    p_image_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_agent RECORD;
    v_voice JSONB;
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

    v_voice := public.resolve_voice_entitlement(v_agent.workspace_id);

    IF p_wa_message_id IS NOT NULL AND p_wa_message_id <> '' THEN
        SELECT id INTO v_existing_msg
        FROM public.messages
        WHERE wa_message_id = p_wa_message_id
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object('ok', FALSE, 'reason', 'duplicate_message');
        END IF;
    END IF;

    SELECT id INTO v_contact_id
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

    SELECT id, control_mode, unread_count, created_at, preferred_language
    INTO v_conv
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
        RETURNING id, control_mode, unread_count, created_at, preferred_language INTO v_conv;
    ELSE
        UPDATE public.conversations
        SET
            last_message_at = NOW(),
            unread_count = COALESCE(unread_count, 0) + 1,
            updated_at = NOW()
        WHERE id = v_conv.id
        RETURNING id, control_mode, unread_count, created_at, preferred_language INTO v_conv;
    END IF;

    INSERT INTO public.messages (
        conversation_id,
        wa_message_id,
        sender_type,
        message_type,
        image_metadata,
        content,
        delivery_status
    )
    VALUES (
        v_conv.id,
        NULLIF(p_wa_message_id, ''),
        'contact',
        COALESCE(p_message_type, 'text'),
        p_image_metadata,
        p_content,
        'received'
    )
    RETURNING id INTO v_msg_id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'workspaceId', v_agent.workspace_id,
        'agentStatus', v_agent.status,
        'agentLanguage', COALESCE(v_agent.primary_language, 'fr'),
        'planSlug', COALESCE(v_voice->>'planSlug', 'free'),
        'hasVoiceUnderstanding', COALESCE((v_voice->>'hasVoiceUnderstanding')::BOOLEAN, FALSE),
        'conversationId', v_conv.id,
        'contactId', v_contact_id,
        'controlMode', v_conv.control_mode,
        'preferredLanguage', v_conv.preferred_language,
        'messageId', v_msg_id,
        'isNewConversation', v_is_new_conv,
        'todayDouala', v_today::TEXT
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_ingest_inbound_message TO service_role;
