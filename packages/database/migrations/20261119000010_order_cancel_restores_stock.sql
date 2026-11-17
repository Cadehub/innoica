-- ====================================================================
-- INNOICA — Restore stock when a merchant cancels an order (Milestone 5)
-- create_store_order decrements stock atomically; cancelling must give it back,
-- exactly once (only on the transition non-cancelled -> cancelled).
-- ====================================================================

CREATE OR REPLACE FUNCTION public.update_store_order_status(
    p_order_id UUID,
    p_order_status TEXT DEFAULT NULL,
    p_payment_status TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Commande introuvable : %', p_order_id USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.is_workspace_merchant(v_order.workspace_id) THEN
        RAISE EXCEPTION 'Accès refusé : privilèges commerçant insuffisants pour ce workspace' USING ERRCODE = '42501';
    END IF;

    IF p_order_status IS NOT NULL
       AND p_order_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Statut de commande invalide : %', p_order_status USING ERRCODE = '22023';
    END IF;

    IF p_payment_status IS NOT NULL
       AND p_payment_status NOT IN ('pending_verification', 'paid', 'failed', 'refunded') THEN
        RAISE EXCEPTION 'Statut de paiement invalide : %', p_payment_status USING ERRCODE = '22023';
    END IF;

    -- A cancelled order is final: stock was already returned, re-opening it would desync stock.
    IF v_order.order_status = 'cancelled' AND p_order_status IS NOT NULL AND p_order_status <> 'cancelled' THEN
        RAISE EXCEPTION 'Une commande annulée ne peut pas être réactivée' USING ERRCODE = '22023';
    END IF;

    IF p_order_status = 'cancelled' AND v_order.order_status <> 'cancelled' THEN
        FOR v_item IN
            SELECT product_id, variant_id, quantity
            FROM public.store_order_items
            WHERE order_id = p_order_id
        LOOP
            IF v_item.variant_id IS NOT NULL THEN
                UPDATE public.product_variants
                SET stock_quantity = stock_quantity + v_item.quantity, updated_at = NOW()
                WHERE id = v_item.variant_id AND track_stock = TRUE;
            ELSIF v_item.product_id IS NOT NULL THEN
                UPDATE public.products
                SET stock_quantity = stock_quantity + v_item.quantity, updated_at = NOW()
                WHERE id = v_item.product_id AND track_stock = TRUE;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.store_orders
    SET
        order_status = COALESCE(p_order_status, order_status),
        payment_status = COALESCE(p_payment_status, payment_status),
        notes = CASE WHEN p_notes IS NOT NULL THEN p_notes ELSE notes END,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'orderId', p_order_id,
        'orderStatus', COALESCE(p_order_status, v_order.order_status),
        'paymentStatus', COALESCE(p_payment_status, v_order.payment_status)
    );
END;
$$;
