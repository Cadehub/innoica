-- ====================================================================
-- INNOICA WhatsApp Agent Studio — Milestone 3 Migration
-- 20261118000008_native_ecommerce_engine_and_rls.sql
-- Native Multi-Tenant E-Commerce Engine & Supabase RLS (Requirement R3)
-- Zero external connectors: fully self-hosted by INNOICA
-- ====================================================================

-- 0. Update workspace_members check constraint to explicitly include 'agent' role
ALTER TABLE public.workspace_members
    DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'agent'));

-- 1. Helper function: verify merchant membership (owner, admin, agent, member) or super admin
CREATE OR REPLACE FUNCTION public.is_workspace_merchant(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'member', 'agent')
    ) OR public.is_current_user_super_admin();
$$;

-- 2. TABLE: public.store_settings (Per-workspace store configuration & visual layout)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID UNIQUE NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    store_slug TEXT UNIQUE NOT NULL,
    store_name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    theme_color TEXT NOT NULL DEFAULT '#25D366',
    currency TEXT NOT NULL DEFAULT 'XAF',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    builder_layout JSONB NOT NULL DEFAULT '{"themeColor":"#25D366","sections":[]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE: public.product_categories
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_categories_workspace_slug_key UNIQUE (workspace_id, slug)
);

-- 4. TABLE: public.products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    base_price_xaf INT NOT NULL CHECK (base_price_xaf >= 0),
    compare_at_price_xaf INT CHECK (compare_at_price_xaf IS NULL OR compare_at_price_xaf >= 0),
    cost_price_xaf INT CHECK (cost_price_xaf IS NULL OR cost_price_xaf >= 0),
    images TEXT[] NOT NULL DEFAULT '{}',
    sku TEXT,
    barcode TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    has_variants BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT products_workspace_slug_key UNIQUE (workspace_id, slug)
);

-- 5. TABLE: public.product_variants
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sku TEXT,
    price_xaf INT NOT NULL CHECK (price_xaf >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE: public.delivery_zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    fee_xaf INT NOT NULL CHECK (fee_xaf >= 0),
    estimated_delivery_time TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allows_pickup BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABLE: public.store_customers
CREATE TABLE IF NOT EXISTS public.store_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    delivery_address TEXT,
    notes TEXT,
    total_orders INT NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
    total_spent_xaf BIGINT NOT NULL DEFAULT 0 CHECK (total_spent_xaf >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT store_customers_workspace_phone_key UNIQUE (workspace_id, phone)
);

-- 8. TABLE: public.store_carts
CREATE TABLE IF NOT EXISTS public.store_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    cart_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.store_customers(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLE: public.store_cart_items
CREATE TABLE IF NOT EXISTS public.store_cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.store_carts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_snapshot_xaf INT NOT NULL CHECK (unit_price_snapshot_xaf >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABLE: public.store_orders
CREATE TABLE IF NOT EXISTS public.store_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.store_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('delivery', 'pickup')),
    delivery_address TEXT,
    delivery_fee_xaf INT NOT NULL DEFAULT 0 CHECK (delivery_fee_xaf >= 0),
    subtotal_xaf INT NOT NULL CHECK (subtotal_xaf >= 0),
    total_amount_xaf INT NOT NULL CHECK (total_amount_xaf >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash_on_delivery', 'pickup', 'manual_mobile_money')),
    payment_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (payment_status IN ('pending_verification', 'paid', 'failed', 'refunded')),
    manual_payment_ref TEXT,
    manual_payment_phone TEXT,
    order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABLE: public.store_order_items
CREATE TABLE IF NOT EXISTS public.store_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_title TEXT NOT NULL,
    variant_title TEXT,
    sku TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_xaf INT NOT NULL CHECK (unit_price_xaf >= 0),
    total_price_xaf INT NOT NULL CHECK (total_price_xaf >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABLE: public.store_order_counters (Atomic per-day order sequence counter)
CREATE TABLE IF NOT EXISTS public.store_order_counters (
    counter_date DATE PRIMARY KEY,
    last_seq INT NOT NULL DEFAULT 0
);

-- 13. INDEXES
CREATE INDEX IF NOT EXISTS idx_store_settings_workspace_id ON public.store_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_store_slug ON public.store_settings(store_slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_workspace_id ON public.product_categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON public.product_categories(workspace_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_workspace_id ON public.products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(workspace_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_workspace_id ON public.product_variants(workspace_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_workspace_id ON public.delivery_zones(workspace_id);
CREATE INDEX IF NOT EXISTS idx_store_customers_workspace_phone ON public.store_customers(workspace_id, phone);
CREATE INDEX IF NOT EXISTS idx_store_carts_token ON public.store_carts(cart_token);
CREATE INDEX IF NOT EXISTS idx_store_carts_workspace_id ON public.store_carts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_store_cart_items_cart_id ON public.store_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_workspace_id ON public.store_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_order_number ON public.store_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_store_orders_customer_id ON public.store_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_order_id ON public.store_order_items(order_id);

-- 14. UPDATED_AT TRIGGER FUNCTION & TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated_at BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated_at BEFORE UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_store_customers_updated_at ON public.store_customers;
CREATE TRIGGER trg_store_customers_updated_at BEFORE UPDATE ON public.store_customers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_store_carts_updated_at ON public.store_carts;
CREATE TRIGGER trg_store_carts_updated_at BEFORE UPDATE ON public.store_carts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_store_cart_items_updated_at ON public.store_cart_items;
CREATE TRIGGER trg_store_cart_items_updated_at BEFORE UPDATE ON public.store_cart_items
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_store_orders_updated_at ON public.store_orders;
CREATE TRIGGER trg_store_orders_updated_at BEFORE UPDATE ON public.store_orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 15. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Merchant full access store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public read active store_settings" ON public.store_settings;
DROP POLICY IF EXISTS "Merchant full access product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public read active product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Merchant full access products" ON public.products;
DROP POLICY IF EXISTS "Public read active products" ON public.products;
DROP POLICY IF EXISTS "Merchant full access product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public read active product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Merchant full access delivery_zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Public read active delivery_zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Merchant full access store_customers" ON public.store_customers;
DROP POLICY IF EXISTS "Merchant full access store_carts" ON public.store_carts;
DROP POLICY IF EXISTS "Public cart access store_carts" ON public.store_carts;
DROP POLICY IF EXISTS "Merchant full access store_cart_items" ON public.store_cart_items;
DROP POLICY IF EXISTS "Public cart items access store_cart_items" ON public.store_cart_items;
DROP POLICY IF EXISTS "Merchant full access store_orders" ON public.store_orders;
DROP POLICY IF EXISTS "Merchant full access store_order_items" ON public.store_order_items;

-- Store Settings Policies
CREATE POLICY "Merchant full access store_settings" ON public.store_settings
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public read active store_settings" ON public.store_settings
    FOR SELECT
    USING (is_active = TRUE);

-- Product Categories Policies
CREATE POLICY "Merchant full access product_categories" ON public.product_categories
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public read active product_categories" ON public.product_categories
    FOR SELECT
    USING (is_active = TRUE);

-- Products Policies
CREATE POLICY "Merchant full access products" ON public.products
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public read active products" ON public.products
    FOR SELECT
    USING (is_active = TRUE);

-- Product Variants Policies
CREATE POLICY "Merchant full access product_variants" ON public.product_variants
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public read active product_variants" ON public.product_variants
    FOR SELECT
    USING (is_active = TRUE);

-- Delivery Zones Policies
CREATE POLICY "Merchant full access delivery_zones" ON public.delivery_zones
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public read active delivery_zones" ON public.delivery_zones
    FOR SELECT
    USING (is_active = TRUE);

-- Store Customers Policies (Merchants only, public access via create_store_order RPC)
CREATE POLICY "Merchant full access store_customers" ON public.store_customers
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

-- Store Carts Policies (Merchants + Public token-scoped)
CREATE POLICY "Merchant full access store_carts" ON public.store_carts
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public cart insert store_carts" ON public.store_carts
    FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Public cart select store_carts" ON public.store_carts
    FOR SELECT
    USING (
        cart_token::text = COALESCE(
            NULLIF(current_setting('request.headers', true)::json->>'x-cart-token', ''),
            NULLIF(current_setting('app.current_cart_token', true), '')
        )
    );

CREATE POLICY "Public cart update store_carts" ON public.store_carts
    FOR UPDATE
    USING (
        cart_token::text = COALESCE(
            NULLIF(current_setting('request.headers', true)::json->>'x-cart-token', ''),
            NULLIF(current_setting('app.current_cart_token', true), '')
        )
    )
    WITH CHECK (
        cart_token::text = COALESCE(
            NULLIF(current_setting('request.headers', true)::json->>'x-cart-token', ''),
            NULLIF(current_setting('app.current_cart_token', true), '')
        )
    );

-- Store Cart Items Policies
CREATE POLICY "Merchant full access store_cart_items" ON public.store_cart_items
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

CREATE POLICY "Public cart items access store_cart_items" ON public.store_cart_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.store_carts c
            WHERE c.id = store_cart_items.cart_id
              AND c.cart_token::text = COALESCE(
                  NULLIF(current_setting('request.headers', true)::json->>'x-cart-token', ''),
                  NULLIF(current_setting('app.current_cart_token', true), '')
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.store_carts c
            WHERE c.id = store_cart_items.cart_id
              AND c.cart_token::text = COALESCE(
                  NULLIF(current_setting('request.headers', true)::json->>'x-cart-token', ''),
                  NULLIF(current_setting('app.current_cart_token', true), '')
              )
        )
    );

-- Store Orders Policies (Merchants only, customers create via atomic RPC create_store_order)
CREATE POLICY "Merchant full access store_orders" ON public.store_orders
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));

-- Store Order Items Policies
CREATE POLICY "Merchant full access store_order_items" ON public.store_order_items
    FOR ALL
    USING (public.is_workspace_merchant(workspace_id))
    WITH CHECK (public.is_workspace_merchant(workspace_id));


-- 16. FUNCTION: generate_store_order_number() -> CMD-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_store_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'Africa/Douala')::DATE;
    v_seq INT;
    v_date_str TEXT := to_char(v_today, 'YYYYMMDD');
BEGIN
    INSERT INTO public.store_order_counters (counter_date, last_seq)
    VALUES (v_today, 1)
    ON CONFLICT (counter_date)
    DO UPDATE SET last_seq = store_order_counters.last_seq + 1
    RETURNING last_seq INTO v_seq;

    RETURN 'CMD-' || v_date_str || '-' || lpad(v_seq::text, 4, '0');
END;
$$;


-- 17. ATOMIC STORED PROCEDURE: create_store_order(...)
-- SECURITY DEFINER and search_path = public
-- Locks product and variant rows with SELECT ... FOR UPDATE
-- Recalculates subtotal strictly from DB prices
-- Validates delivery fee, updates customer, creates order & items atomically
CREATE OR REPLACE FUNCTION public.create_store_order(
    p_store_slug TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_delivery_zone_id UUID DEFAULT NULL,
    p_delivery_method TEXT DEFAULT 'delivery',
    p_delivery_address TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cash_on_delivery',
    p_items JSONB DEFAULT '[]'::jsonb,
    p_manual_payment_ref TEXT DEFAULT NULL,
    p_manual_payment_phone TEXT DEFAULT NULL,
    p_delivery_notes TEXT DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL,
    p_cart_token UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id UUID;
    v_store_active BOOLEAN;
    v_entitlement JSONB;
    v_delivery_fee_xaf INT := 0;
    v_zone_fee INT;
    v_zone_active BOOLEAN;
    v_subtotal_xaf INT := 0;
    v_total_amount_xaf INT := 0;
    v_customer_id UUID;
    v_order_id UUID;
    v_order_number TEXT;
    v_item JSONB;
    v_prod_id UUID;
    v_var_id UUID;
    v_qty INT;
    v_product RECORD;
    v_variant RECORD;
    v_unit_price INT;
    v_line_total INT;
    v_sku TEXT;
    v_variant_title TEXT;
    v_prepared_items JSONB := '[]'::jsonb;
BEGIN
    -- 1. Validate Store
    IF p_store_slug IS NULL OR trim(p_store_slug) = '' THEN
        RAISE EXCEPTION 'Le slug de la boutique est obligatoire' USING ERRCODE = '22023';
    END IF;

    SELECT workspace_id, is_active INTO v_workspace_id, v_store_active
    FROM public.store_settings
    WHERE store_slug = trim(p_store_slug);

    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Boutique introuvable pour le slug : %', p_store_slug USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_store_active THEN
        RAISE EXCEPTION 'Cette boutique est actuellement fermée ou désactivée' USING ERRCODE = 'P0003';
    END IF;

    -- 2. Verify workspace e-commerce capability if resolve_store_entitlement exists
    BEGIN
        v_entitlement := public.resolve_store_entitlement(v_workspace_id);
        IF v_entitlement IS NOT NULL
           AND (v_entitlement->>'ok')::boolean = TRUE
           AND (v_entitlement->>'ecommerce')::boolean = FALSE THEN
            RAISE EXCEPTION 'Cette boutique requiert un abonnement INNOICA Commerce actif' USING ERRCODE = '42501';
        END IF;
    EXCEPTION
        WHEN undefined_function THEN
            NULL; -- In isolated test setups without entitlement function
    END;

    -- 3. Validate Customer Information
    IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
        RAISE EXCEPTION 'Le nom du client est requis (minimum 2 caractères)' USING ERRCODE = '22023';
    END IF;

    IF p_customer_phone IS NULL OR length(trim(p_customer_phone)) < 6 THEN
        RAISE EXCEPTION 'Le numéro de téléphone du client est requis (minimum 6 chiffres)' USING ERRCODE = '22023';
    END IF;

    -- 4. Validate Delivery Method & Delivery Zone
    IF p_delivery_method NOT IN ('delivery', 'pickup') THEN
        RAISE EXCEPTION 'Mode de livraison invalide : % (valeurs autorisées : delivery, pickup)', p_delivery_method USING ERRCODE = '22023';
    END IF;

    IF p_delivery_method = 'delivery' THEN
        IF p_delivery_address IS NULL OR length(trim(p_delivery_address)) < 3 THEN
            RAISE EXCEPTION 'Une adresse de livraison est requise pour le mode livraison à domicile' USING ERRCODE = '22023';
        END IF;

        IF p_delivery_zone_id IS NOT NULL THEN
            SELECT fee_xaf, is_active INTO v_zone_fee, v_zone_active
            FROM public.delivery_zones
            WHERE id = p_delivery_zone_id AND workspace_id = v_workspace_id;

            IF v_zone_fee IS NULL THEN
                RAISE EXCEPTION 'Zone de livraison introuvable pour cette boutique' USING ERRCODE = 'P0002';
            END IF;

            IF NOT v_zone_active THEN
                RAISE EXCEPTION 'Cette zone de livraison est actuellement désactivée' USING ERRCODE = 'P0003';
            END IF;

            v_delivery_fee_xaf := v_zone_fee;
        ELSE
            v_delivery_fee_xaf := 0;
        END IF;
    ELSE
        -- Mode pickup (retrait sur place) : frais strictement nuls
        v_delivery_fee_xaf := 0;
    END IF;

    -- 5. Validate Payment Method
    IF p_payment_method NOT IN ('cash_on_delivery', 'pickup', 'manual_mobile_money') THEN
        RAISE EXCEPTION 'Mode de paiement invalide : % (valeurs autorisées : cash_on_delivery, pickup, manual_mobile_money)', p_payment_method USING ERRCODE = '22023';
    END IF;

    -- 6. Validate Items Array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Le panier est vide ou le format des articles est invalide' USING ERRCODE = '22023';
    END IF;

    -- 7. Process each item: row-level locking, price calculation, stock decrement
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := COALESCE(
            NULLIF(v_item->>'productId', '')::UUID,
            NULLIF(v_item->>'product_id', '')::UUID
        );
        v_var_id := COALESCE(
            NULLIF(v_item->>'variantId', '')::UUID,
            NULLIF(v_item->>'variant_id', '')::UUID
        );
        v_qty := COALESCE(
            (v_item->>'quantity')::INT,
            (v_item->>'qty')::INT,
            0
        );

        IF v_prod_id IS NULL THEN
            RAISE EXCEPTION 'Chaque article doit comporter un identifiant de produit valide' USING ERRCODE = '22023';
        END IF;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La quantité commandée doit être un entier strictement positif' USING ERRCODE = '22023';
        END IF;

        -- Lock product row with SELECT ... FOR UPDATE
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_prod_id AND workspace_id = v_workspace_id AND is_active = TRUE
        FOR UPDATE;

        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Produit introuvable ou inactif : %', v_prod_id USING ERRCODE = 'P0002';
        END IF;

        IF v_var_id IS NOT NULL THEN
            -- Lock variant row with SELECT ... FOR UPDATE
            SELECT * INTO v_variant
            FROM public.product_variants
            WHERE id = v_var_id AND product_id = v_prod_id AND workspace_id = v_workspace_id AND is_active = TRUE
            FOR UPDATE;

            IF v_variant.id IS NULL THEN
                RAISE EXCEPTION 'Variante introuvable ou inactive : %', v_var_id USING ERRCODE = 'P0002';
            END IF;

            -- Recalculate price strictly from DB variant row
            v_unit_price := v_variant.price_xaf;
            v_sku := v_variant.sku;
            v_variant_title := v_variant.title;

            -- Decrement variant stock atomically if track_stock is true
            IF v_variant.track_stock THEN
                IF v_variant.stock_quantity < v_qty THEN
                    RAISE EXCEPTION 'Stock insuffisant pour l''article % (%) : % restant(s), % demandé(s)',
                        v_product.title, v_variant.title, v_variant.stock_quantity, v_qty
                        USING ERRCODE = 'P0004';
                END IF;

                UPDATE public.product_variants
                SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
                WHERE id = v_variant.id;
            END IF;

            -- Decrement parent product stock if parent product tracks stock
            IF v_product.track_stock THEN
                IF v_product.stock_quantity < v_qty THEN
                    RAISE EXCEPTION 'Stock global insuffisant pour le produit % : % restant(s), % demandé(s)',
                        v_product.title, v_product.stock_quantity, v_qty
                        USING ERRCODE = 'P0004';
                END IF;

                UPDATE public.products
                SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
                WHERE id = v_product.id;
            END IF;
        ELSE
            -- Simple product without variant
            IF v_product.has_variants THEN
                RAISE EXCEPTION 'Veuillez sélectionner une variante pour le produit : %', v_product.title USING ERRCODE = '22023';
            END IF;

            -- Recalculate price strictly from DB product row
            v_unit_price := v_product.base_price_xaf;
            v_sku := v_product.sku;
            v_variant_title := NULL;

            -- Decrement product stock atomically if track_stock is true
            IF v_product.track_stock THEN
                IF v_product.stock_quantity < v_qty THEN
                    RAISE EXCEPTION 'Stock insuffisant pour le produit % : % restant(s), % demandé(s)',
                        v_product.title, v_product.stock_quantity, v_qty
                        USING ERRCODE = 'P0004';
                END IF;

                UPDATE public.products
                SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
                WHERE id = v_product.id;
            END IF;
        END IF;

        v_line_total := v_unit_price * v_qty;
        v_subtotal_xaf := v_subtotal_xaf + v_line_total;

        v_prepared_items := v_prepared_items || jsonb_build_object(
            'productId', v_prod_id,
            'variantId', v_var_id,
            'productTitle', v_product.title,
            'variantTitle', v_variant_title,
            'sku', v_sku,
            'quantity', v_qty,
            'unitPriceXaf', v_unit_price,
            'totalPriceXaf', v_line_total
        );
    END LOOP;

    -- 8. Calculate total amount
    v_total_amount_xaf := v_subtotal_xaf + v_delivery_fee_xaf;

    -- 9. Upsert store_customers record
    INSERT INTO public.store_customers (
        workspace_id,
        full_name,
        phone,
        email,
        delivery_address,
        total_orders,
        total_spent_xaf,
        updated_at
    )
    VALUES (
        v_workspace_id,
        trim(p_customer_name),
        trim(p_customer_phone),
        NULLIF(trim(p_customer_email), ''),
        NULLIF(trim(p_delivery_address), ''),
        1,
        v_total_amount_xaf,
        NOW()
    )
    ON CONFLICT (workspace_id, phone) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = COALESCE(EXCLUDED.email, store_customers.email),
        delivery_address = COALESCE(EXCLUDED.delivery_address, store_customers.delivery_address),
        total_orders = store_customers.total_orders + 1,
        total_spent_xaf = store_customers.total_spent_xaf + EXCLUDED.total_spent_xaf,
        updated_at = NOW()
    RETURNING id INTO v_customer_id;

    -- 10. Generate Unique Order Number
    v_order_number := public.generate_store_order_number();

    -- 11. Insert Order
    INSERT INTO public.store_orders (
        workspace_id,
        order_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        delivery_zone_id,
        delivery_method,
        delivery_address,
        delivery_fee_xaf,
        subtotal_xaf,
        total_amount_xaf,
        payment_method,
        payment_status,
        manual_payment_ref,
        manual_payment_phone,
        order_status,
        notes,
        metadata
    )
    VALUES (
        v_workspace_id,
        v_order_number,
        v_customer_id,
        trim(p_customer_name),
        trim(p_customer_phone),
        NULLIF(trim(p_customer_email), ''),
        p_delivery_zone_id,
        p_delivery_method,
        p_delivery_address,
        v_delivery_fee_xaf,
        v_subtotal_xaf,
        v_total_amount_xaf,
        p_payment_method,
        'pending_verification',
        NULLIF(trim(p_manual_payment_ref), ''),
        NULLIF(trim(p_manual_payment_phone), ''),
        'pending',
        p_delivery_notes,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_order_id;

    -- 12. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_prepared_items)
    LOOP
        INSERT INTO public.store_order_items (
            order_id,
            workspace_id,
            product_id,
            variant_id,
            product_title,
            variant_title,
            sku,
            quantity,
            unit_price_xaf,
            total_price_xaf
        )
        VALUES (
            v_order_id,
            v_workspace_id,
            (v_item->>'productId')::UUID,
            NULLIF(v_item->>'variantId', '')::UUID,
            v_item->>'productTitle',
            v_item->>'variantTitle',
            v_item->>'sku',
            (v_item->>'quantity')::INT,
            (v_item->>'unitPriceXaf')::INT,
            (v_item->>'totalPriceXaf')::INT
        );
    END LOOP;

    -- 13. If cart token was provided, clean up cart items
    IF p_cart_token IS NOT NULL THEN
        DELETE FROM public.store_cart_items
        WHERE cart_id IN (
            SELECT id FROM public.store_carts
            WHERE cart_token = p_cart_token AND workspace_id = v_workspace_id
        );
    END IF;

    -- 14. Return standardized confirmation JSONB
    RETURN jsonb_build_object(
        'ok', TRUE,
        'orderId', v_order_id,
        'orderNumber', v_order_number,
        'subtotalXaf', v_subtotal_xaf,
        'deliveryFeeXaf', v_delivery_fee_xaf,
        'totalXaf', v_total_amount_xaf,
        'paymentStatus', 'pending_verification'
    );
END;
$$;


-- 18. STORED PROCEDURE: update_store_order_status(...)
-- Allows merchants to update status (e.g. human verification of manual Mobile Money)
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
BEGIN
    SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'Commande introuvable : %', p_order_id USING ERRCODE = 'P0002';
    END IF;

    -- Enforce merchant membership check
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


-- 19. CART HELPER RPC: get_or_create_store_cart(...)
CREATE OR REPLACE FUNCTION public.get_or_create_store_cart(
    p_workspace_id UUID,
    p_cart_token UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart RECORD;
    v_token UUID := p_cart_token;
BEGIN
    IF v_token IS NOT NULL THEN
        SELECT * INTO v_cart FROM public.store_carts
        WHERE cart_token = v_token AND workspace_id = p_workspace_id;
    END IF;

    IF v_cart.id IS NULL THEN
        v_token := COALESCE(p_cart_token, gen_random_uuid());
        INSERT INTO public.store_carts (workspace_id, cart_token)
        VALUES (p_workspace_id, v_token)
        RETURNING * INTO v_cart;
    END IF;

    RETURN jsonb_build_object(
        'id', v_cart.id,
        'workspaceId', v_cart.workspace_id,
        'cartToken', v_cart.cart_token,
        'expiresAt', v_cart.expires_at,
        'createdAt', v_cart.created_at
    );
END;
$$;
