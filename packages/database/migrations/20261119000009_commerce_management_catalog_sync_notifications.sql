-- ====================================================================
-- INNOICA — Milestone 5: Commerce management, WhatsApp catalog sync,
-- merchant order notifications, Super Admin aggregate metrics
-- ====================================================================

-- 1. Merchant notification settings + per-order notification marker
ALTER TABLE public.store_settings
    ADD COLUMN IF NOT EXISTS notification_phone TEXT,
    ADD COLUMN IF NOT EXISTS notify_on_new_order BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.store_settings
    DROP CONSTRAINT IF EXISTS store_settings_notification_phone_format;
ALTER TABLE public.store_settings
    ADD CONSTRAINT store_settings_notification_phone_format
    CHECK (notification_phone IS NULL OR notification_phone ~ '^\+?[0-9]{8,15}$');

ALTER TABLE public.store_orders
    ADD COLUMN IF NOT EXISTS merchant_notified_at TIMESTAMPTZ;

-- 2. Catalog context for the WhatsApp agent (worker-authenticated, entitlement-gated)
--    Returns only ACTIVE products of workspaces that own the Commerce entitlement.
CREATE OR REPLACE FUNCTION public.worker_get_catalog_context(
    p_workspace_id UUID,
    p_query TEXT DEFAULT NULL,
    p_limit INT DEFAULT 25,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_ent JSONB;
    v_store RECORD;
    v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 40);
    v_terms TEXT[];
    v_products JSONB;
    v_zones JSONB;
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    v_ent := public.resolve_store_entitlement(p_workspace_id);
    IF COALESCE((v_ent->>'ecommerce')::boolean, FALSE) = FALSE THEN
        RETURN jsonb_build_object('ok', TRUE, 'enabled', FALSE);
    END IF;

    SELECT store_slug, store_name, currency INTO v_store
    FROM public.store_settings
    WHERE workspace_id = p_workspace_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', TRUE, 'enabled', FALSE);
    END IF;

    -- Keyword terms (>= 3 chars, max 6) used only for ranking, never concatenated into SQL
    SELECT COALESCE(array_agg(t), '{}') INTO v_terms
    FROM (
        SELECT DISTINCT lower(w) AS t
        FROM regexp_split_to_table(COALESCE(p_query, ''), '[^[:alnum:]À-ÿ]+') AS w
        WHERE length(w) >= 3
        LIMIT 6
    ) s;

    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_products
    FROM (
        SELECT
            p.id,
            p.title,
            p.slug,
            left(COALESCE(p.description, ''), 280) AS description,
            p.base_price_xaf AS price_xaf,
            p.compare_at_price_xaf,
            CASE WHEN p.track_stock THEN p.stock_quantity ELSE NULL END AS stock_quantity,
            (NOT p.track_stock) OR p.stock_quantity > 0 AS in_stock,
            (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'title', v.title,
                    'price_xaf', v.price_xaf,
                    'in_stock', (NOT v.track_stock) OR v.stock_quantity > 0
                ) ORDER BY v.price_xaf), '[]'::jsonb)
                FROM public.product_variants v
                WHERE v.product_id = p.id AND v.is_active = TRUE
            ) AS variants
        FROM public.products p
        WHERE p.workspace_id = p_workspace_id AND p.is_active = TRUE
        ORDER BY
            (
                SELECT COUNT(*) FROM unnest(v_terms) t
                WHERE lower(p.title || ' ' || COALESCE(p.description, '')) LIKE '%' || t || '%'
            ) DESC,
            p.is_featured DESC,
            p.updated_at DESC
        LIMIT v_limit
    ) r;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', z.name, 'fee_xaf', z.fee_xaf, 'eta', z.estimated_delivery_time
    ) ORDER BY z.fee_xaf), '[]'::jsonb) INTO v_zones
    FROM public.delivery_zones z
    WHERE z.workspace_id = p_workspace_id AND z.is_active = TRUE;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'enabled', TRUE,
        'storeName', v_store.store_name,
        'storeSlug', v_store.store_slug,
        'currency', v_store.currency,
        'products', v_products,
        'deliveryZones', v_zones
    );
END;
$$;

-- 3. Merchant notification payload for a freshly created order
CREATE OR REPLACE FUNCTION public.worker_get_order_notification(
    p_order_id UUID,
    p_worker_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_order RECORD;
    v_store RECORD;
    v_agent_id UUID;
    v_lines TEXT;
BEGIN
    IF NOT private.is_authorized_worker(p_worker_secret) THEN
        RAISE EXCEPTION 'Unauthorized worker access';
    END IF;

    SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id;
    IF NOT FOUND OR v_order.merchant_notified_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', TRUE, 'send', FALSE);
    END IF;

    SELECT store_name, notification_phone, notify_on_new_order INTO v_store
    FROM public.store_settings WHERE workspace_id = v_order.workspace_id;

    IF NOT FOUND OR v_store.notify_on_new_order = FALSE OR v_store.notification_phone IS NULL THEN
        RETURN jsonb_build_object('ok', TRUE, 'send', FALSE);
    END IF;

    -- Only entitled (Commerce) workspaces get notifications
    IF COALESCE((public.resolve_store_entitlement(v_order.workspace_id)->>'ecommerce')::boolean, FALSE) = FALSE THEN
        RETURN jsonb_build_object('ok', TRUE, 'send', FALSE);
    END IF;

    SELECT wc.agent_id INTO v_agent_id
    FROM public.whatsapp_connections wc
    WHERE wc.workspace_id = v_order.workspace_id AND wc.status = 'connected'
    ORDER BY wc.last_connected_at DESC NULLS LAST
    LIMIT 1;

    IF v_agent_id IS NULL THEN
        RETURN jsonb_build_object('ok', TRUE, 'send', FALSE, 'reason', 'no_connected_agent');
    END IF;

    SELECT string_agg(
        '• ' || i.quantity || ' x ' || i.product_title ||
        COALESCE(' (' || i.variant_title || ')', '') ||
        ' — ' || i.total_price_xaf || ' FCFA', E'\n' ORDER BY i.created_at)
    INTO v_lines
    FROM public.store_order_items i WHERE i.order_id = v_order.id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'send', TRUE,
        'agentId', v_agent_id,
        'toPhone', v_store.notification_phone,
        'text',
            '🛒 Nouvelle commande ' || v_order.order_number || ' — ' || v_store.store_name || E'\n\n' ||
            COALESCE(v_lines, '') || E'\n\n' ||
            'Sous-total : ' || v_order.subtotal_xaf || ' FCFA' || E'\n' ||
            'Livraison : ' || v_order.delivery_fee_xaf || ' FCFA' || E'\n' ||
            'Total : ' || v_order.total_amount_xaf || ' FCFA' || E'\n' ||
            'Paiement : ' || v_order.payment_method || ' (' || v_order.payment_status || ')' || E'\n\n' ||
            'Client : ' || v_order.customer_name || ' — ' || v_order.customer_phone ||
            CASE WHEN v_order.delivery_method = 'delivery'
                 THEN E'\nAdresse : ' || COALESCE(v_order.delivery_address, 'non précisée')
                 ELSE E'\nRetrait en boutique' END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_mark_order_notified(
    p_order_id UUID,
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
    UPDATE public.store_orders
    SET merchant_notified_at = NOW()
    WHERE id = p_order_id AND merchant_notified_at IS NULL;
END;
$$;

-- 4. Super Admin aggregate metrics (privacy-preserving: counts and sums only,
--    no customer names/phones/addresses, no per-merchant order details)
CREATE OR REPLACE FUNCTION public.admin_get_commerce_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Super Admin access required';
    END IF;

    RETURN jsonb_build_object(
        'activeStores', (SELECT COUNT(*) FROM public.store_settings WHERE is_active),
        'totalProducts', (SELECT COUNT(*) FROM public.products WHERE is_active),
        'orders30d', (SELECT COUNT(*) FROM public.store_orders WHERE created_at >= NOW() - INTERVAL '30 days'),
        'orders7d', (SELECT COUNT(*) FROM public.store_orders WHERE created_at >= NOW() - INTERVAL '7 days'),
        'gmv30dXaf', (SELECT COALESCE(SUM(total_amount_xaf), 0) FROM public.store_orders
                      WHERE created_at >= NOW() - INTERVAL '30 days' AND order_status <> 'cancelled'),
        'cancelled30d', (SELECT COUNT(*) FROM public.store_orders
                         WHERE created_at >= NOW() - INTERVAL '30 days' AND order_status = 'cancelled'),
        'commerceWorkspaces', (SELECT COUNT(DISTINCT s.workspace_id) FROM public.subscriptions s
                               JOIN public.plans pl ON pl.id = s.plan_id
                               WHERE pl.slug = 'commerce' AND s.status = 'active'),
        'agentWorkspaces', (SELECT COUNT(DISTINCT s.workspace_id) FROM public.subscriptions s
                            JOIN public.plans pl ON pl.id = s.plan_id
                            WHERE pl.slug = 'agent' AND s.status = 'active')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_get_catalog_context TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_get_order_notification TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_mark_order_notified TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_get_commerce_metrics FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_commerce_metrics TO authenticated, service_role;
