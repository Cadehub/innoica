-- ====================================================================
-- INNOICA WhatsApp Agents v2.1 — Knowledge Enrichment & Multi-Source URL Ingestion
-- ====================================================================

CREATE OR REPLACE FUNCTION public.worker_get_ai_context(
    p_agent_id uuid,
    p_conversation_id uuid,
    p_worker_secret text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
    v_agent RECORD;
    v_conv RECORD;
    v_cred RECORD;
    v_plan RECORD;
    v_voice JSONB;
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
    v_voice := public.resolve_voice_entitlement(v_agent.workspace_id);
    SELECT * INTO v_settings FROM public.app_commercial_settings WHERE id = 'default';

    IF v_agent.ai_credential_id IS NOT NULL THEN
        SELECT id, provider, encrypted_api_key INTO v_cred
        FROM public.ai_credentials
        WHERE id = v_agent.ai_credential_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', cm.key, 'value', cm.value)), '[]'::jsonb)
    INTO v_contact_memories
    FROM public.contact_memories cm
    WHERE cm.contact_id = v_conv.contact_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', cvm.key, 'value', cvm.value)), '[]'::jsonb)
    INTO v_conv_memories
    FROM public.conversation_memories cvm
    WHERE cvm.conversation_id = p_conversation_id;
    
    -- Enrichissement des connaissances avec le titre, l'URL, le type et le contenu
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'title', COALESCE(s.title, 'Document'),
                'source_type', COALESCE(s.source_type, 'txt'),
                'source_url', s.source_url,
                'chunk_index', kc.chunk_index,
                'content', kc.content
            )
            ORDER BY s.updated_at DESC, kc.chunk_index ASC
        ),
        '[]'::jsonb
    )
    INTO v_knowledge
    FROM (
        SELECT kc.source_id, kc.chunk_index, kc.content
        FROM public.agent_knowledge_chunks kc
        JOIN public.agent_knowledge_sources s2 ON s2.id = kc.source_id
        WHERE kc.agent_id = p_agent_id AND s2.status = 'ready'
        ORDER BY s2.updated_at DESC, kc.chunk_index ASC
        LIMIT 25
    ) kc
    JOIN public.agent_knowledge_sources s ON s.id = kc.source_id;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'sender_type', m.sender_type,
                'message_type', m.message_type,
                'content', m.content,
                'voice_metadata', m.voice_metadata
            )
            ORDER BY m.created_at ASC
        ),
        '[]'::jsonb
    )
    INTO v_messages
    FROM (
        SELECT sender_type, message_type, content, voice_metadata, created_at
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
        'voiceEntitlement', v_voice,
        'settings', row_to_json(v_settings),
        'contactMemories', v_contact_memories,
        'conversationMemories', v_conv_memories,
        'knowledgeChunks', v_knowledge,
        'recentMessages', v_messages
    );
END;
$function$;
