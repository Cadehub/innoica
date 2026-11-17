// ====================================================================
// INNOICA WhatsApp Agents v2.0 — E-Commerce Domain Types
// Native Multi-Tenant E-Commerce Engine (Requirement R3)
// ====================================================================

export type DeliveryMethod = 'delivery' | 'pickup';

export type PaymentMethod = 'cash_on_delivery' | 'pickup' | 'manual_mobile_money';

export type PaymentStatus = 'pending_verification' | 'paid' | 'failed' | 'refunded';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type StoreBuilderSectionType =
  | 'hero'
  | 'catalog_grid'
  | 'features_banner'
  | 'about'
  | 'footer';

export interface StoreBuilderSection {
  id: string;
  type: StoreBuilderSectionType;
  visible: boolean;
  order: number;
  settings: Record<string, unknown>;
}

export interface StoreBuilderLayout {
  themeColor: string;
  sections: StoreBuilderSection[];
  announcement?: {
    enabled: boolean;
    text: string;
  };
  draft?: {
    themeColor: string;
    sections: StoreBuilderSection[];
    announcement?: {
      enabled: boolean;
      text: string;
    };
    savedAt: string;
  };
  history?: Array<{
    themeColor: string;
    sections: StoreBuilderSection[];
    announcement?: {
      enabled: boolean;
      text: string;
    };
    publishedAt: string;
    version: number;
  }>;
}

// 1. Store Settings Table Model
export interface StoreSettings {
  id: string;
  workspace_id: string;
  store_slug: string;
  store_name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  theme_color: string;
  currency: string;
  is_active: boolean;
  builder_layout: StoreBuilderLayout;
  created_at: string;
  updated_at: string;
}

// 2. Product Category Model
export interface ProductCategory {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 3. Product Model
export interface Product {
  id: string;
  workspace_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  base_price_xaf: number;
  compare_at_price_xaf: number | null;
  cost_price_xaf: number | null;
  images: string[];
  sku: string | null;
  barcode: string | null;
  is_active: boolean;
  is_featured: boolean;
  stock_quantity: number;
  track_stock: boolean;
  has_variants: boolean;
  created_at: string;
  updated_at: string;
}

// 4. Product Variant Model
export interface ProductVariant {
  id: string;
  workspace_id: string;
  product_id: string;
  title: string;
  sku: string | null;
  price_xaf: number;
  stock_quantity: number;
  track_stock: boolean;
  attributes: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 5. Delivery Zone Model
export interface DeliveryZone {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  fee_xaf: number;
  estimated_delivery_time: string | null;
  is_active: boolean;
  allows_pickup: boolean;
  created_at: string;
  updated_at: string;
}

// 6. Store Customer Model
export interface StoreCustomer {
  id: string;
  workspace_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  delivery_address: string | null;
  notes: string | null;
  total_orders: number;
  total_spent_xaf: number;
  created_at: string;
  updated_at: string;
}

// 7. Store Cart Model
export interface StoreCart {
  id: string;
  workspace_id: string;
  cart_token: string;
  customer_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// 8. Store Cart Item Model
export interface StoreCartItem {
  id: string;
  cart_id: string;
  workspace_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price_snapshot_xaf: number;
  created_at: string;
  updated_at: string;
}

// 9. Store Order Model
export interface StoreOrder {
  id: string;
  workspace_id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_zone_id: string | null;
  delivery_method: DeliveryMethod;
  delivery_address: string | null;
  delivery_fee_xaf: number;
  subtotal_xaf: number;
  total_amount_xaf: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  manual_payment_ref: string | null;
  manual_payment_phone: string | null;
  order_status: OrderStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// 10. Store Order Item Model
export interface StoreOrderItem {
  id: string;
  order_id: string;
  workspace_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  unit_price_xaf: number;
  total_price_xaf: number;
  created_at: string;
}

// RPC Call Payloads & Results
export interface StoreOrderItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CreateStoreOrderPayload {
  storeSlug: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryZoneId?: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryAddress?: string | null;
  paymentMethod: PaymentMethod;
  items: StoreOrderItemInput[];
  manualPaymentRef?: string | null;
  manualPaymentPhone?: string | null;
  deliveryNotes?: string | null;
  cartToken?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateStoreOrderResult {
  ok: boolean;
  orderId: string;
  orderNumber: string;
  subtotalXaf: number;
  deliveryFeeXaf: number;
  totalXaf: number;
  paymentStatus: PaymentStatus;
}

export interface UpdateStoreOrderStatusPayload {
  orderId: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  notes?: string | null;
}
