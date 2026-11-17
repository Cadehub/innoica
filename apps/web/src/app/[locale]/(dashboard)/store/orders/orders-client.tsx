'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, MessageCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export interface OrderItemRow {
  id: string;
  product_title: string;
  variant_title: string | null;
  quantity: number;
  unit_price_xaf: number;
  total_price_xaf: number;
}

export interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_method: 'delivery' | 'pickup';
  delivery_address: string | null;
  delivery_fee_xaf: number;
  subtotal_xaf: number;
  total_amount_xaf: number;
  payment_method: string;
  payment_status: string;
  manual_payment_ref: string | null;
  order_status: string;
  notes: string | null;
  created_at: string;
  store_order_items: OrderItemRow[];
}

const ORDER_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En préparation' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];

const PAYMENT_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'pending_verification', label: 'À vérifier' },
  { value: 'paid', label: 'Payée' },
  { value: 'failed', label: 'Échec' },
  { value: 'refunded', label: 'Remboursée' },
];

const PAYMENT_METHODS: Record<string, string> = {
  cash_on_delivery: 'Paiement à la livraison',
  pickup: 'Paiement au retrait',
  manual_mobile_money: 'Mobile Money (manuel)',
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

function statusTone(status: string): string {
  switch (status) {
    case 'delivered':
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'cancelled':
    case 'failed':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'pending':
    case 'pending_verification':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-sky-50 text-sky-700 border-sky-200';
  }
}

function whatsappLink(phone: string, orderNumber: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  const text = encodeURIComponent(`Bonjour, concernant votre commande ${orderNumber}`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function OrdersClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.order_status === filter)),
    [orders, filter]
  );

  const revenue = useMemo(
    () =>
      orders
        .filter((o) => o.order_status !== 'cancelled' && o.payment_status === 'paid')
        .reduce((sum, o) => sum + o.total_amount_xaf, 0),
    [orders]
  );
  const pendingCount = orders.filter((o) => o.order_status === 'pending').length;

  async function update(orderId: string, patch: { orderStatus?: string; paymentStatus?: string }) {
    setBusyId(orderId);
    setError(null);
    try {
      const res = await fetch('/api/store/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Mise à jour impossible');
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                order_status: data.orderStatus ?? o.order_status,
                payment_status: data.paymentStatus ?? o.payment_status,
              }
            : o
        )
      );
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5 antialiased">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/80">
          <p className="text-[11px] text-zinc-500">Commandes</p>
          <p className="text-2xl font-black text-zinc-900">{orders.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/80">
          <p className="text-[11px] text-zinc-500">À traiter</p>
          <p className="text-2xl font-black text-amber-600">{pendingCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-zinc-200/80">
          <p className="text-[11px] text-zinc-500">Encaissé (payées)</p>
          <p className="text-2xl font-black text-emerald-700">{fcfa(revenue)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ value: 'all', label: 'Toutes' }, ...ORDER_STATUSES].map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              filter === s.value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-dashed border-zinc-300 text-center text-sm text-zinc-500">
          Aucune commande pour le moment.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((o) => {
            const isOpen = expanded === o.id;
            return (
              <li key={o.id} className="rounded-2xl bg-white border border-zinc-200/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-zinc-50"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-black text-zinc-900">{o.order_number}</p>
                    <p className="text-[11px] text-zinc-500">
                      {o.customer_name} · {new Date(o.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusTone(o.order_status)}`}>
                      {ORDER_STATUSES.find((s) => s.value === o.order_status)?.label || o.order_status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusTone(o.payment_status)}`}>
                      {PAYMENT_STATUSES.find((s) => s.value === o.payment_status)?.label || o.payment_status}
                    </span>
                    <span className="text-sm font-black text-zinc-900">{fcfa(o.total_amount_xaf)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-zinc-100 text-xs text-zinc-700">
                    <ul className="space-y-1">
                      {o.store_order_items.map((it) => (
                        <li key={it.id} className="flex justify-between gap-3">
                          <span>
                            {it.quantity} × {it.product_title}
                            {it.variant_title ? ` (${it.variant_title})` : ''}
                          </span>
                          <span className="font-bold">{fcfa(it.total_price_xaf)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="grid sm:grid-cols-2 gap-1 text-[11px] text-zinc-500">
                      <span>Sous-total : {fcfa(o.subtotal_xaf)}</span>
                      <span>Livraison : {fcfa(o.delivery_fee_xaf)}</span>
                      <span>Paiement : {PAYMENT_METHODS[o.payment_method] || o.payment_method}</span>
                      {o.manual_payment_ref && <span>Réf. paiement : {o.manual_payment_ref}</span>}
                      <span>
                        {o.delivery_method === 'delivery'
                          ? `Livraison : ${o.delivery_address || 'adresse non précisée'}`
                          : 'Retrait en boutique'}
                      </span>
                      <span>Téléphone : {o.customer_phone}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <select
                        value={o.order_status}
                        disabled={busyId === o.id || o.order_status === 'cancelled'}
                        title={o.order_status === 'cancelled' ? 'Une commande annulée est définitive (stock déjà restitué)' : undefined}
                        onChange={(e) => update(o.id, { orderStatus: e.target.value })}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs cursor-pointer"
                        aria-label="Statut de la commande"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <select
                        value={o.payment_status}
                        disabled={busyId === o.id}
                        onChange={(e) => update(o.id, { paymentStatus: e.target.value })}
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs cursor-pointer"
                        aria-label="Statut du paiement"
                      >
                        {PAYMENT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      {busyId === o.id && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                      <a
                        href={whatsappLink(o.customer_phone, o.order_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Contacter le client
                      </a>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
