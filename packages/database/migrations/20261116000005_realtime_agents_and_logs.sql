-- Migration 20261116000005: Publication Supabase Realtime pour agents et execution_logs
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
