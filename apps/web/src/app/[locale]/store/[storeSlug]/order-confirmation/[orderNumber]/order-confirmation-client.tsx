'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Copy,
  Check,
  MessageCircle,
  Truck,
  Building,
  CreditCard,
  ShoppingBag,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { formatPriceXaf } from '@/lib/utils';

interface OrderConfirmationClientProps {
  order: any;
  items: any[];
  storeSlug: string;
  storeName: string;
  themeColor?: string;
  merchantPhone?: string;
}

export function OrderConfirmationClient({
  order,
  items,
  storeSlug,
  storeName,
  themeColor = '#25D366',
  merchantPhone = '',
}: OrderConfirmationClientProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanPhone = (merchantPhone || '').replace(/\D/g, '');
  const waText = `Bonjour ${storeName}, je viens de valider la commande ${order.order_number} d'un montant de ${formatPriceXaf(
    order.total_amount_xaf
  )} sur votre boutique. Nom : ${order.customer_name}, Tél : ${order.customer_phone}. Pouvez-vous confirmer la prise en charge ?`;
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 antialiased space-y-8">
      {/* Celebration Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-zinc-200/80 shadow-xs text-center space-y-4">
        <div
          className="h-16 w-16 mx-auto rounded-full flex items-center justify-center text-white shadow-md animate-fade-in"
          style={{ backgroundColor: themeColor }}
        >
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            Merci pour votre commande !
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-md mx-auto">
            Votre commande a bien été enregistrée par <span className="font-bold text-zinc-800">{storeName}</span>.
          </p>
        </div>

        {/* Order Number Badge */}
        <div className="inline-flex items-center gap-2 p-1.5 pl-3.5 pr-2 rounded-xl bg-zinc-100 border border-zinc-200">
          <span className="text-xs font-mono font-bold text-zinc-900 tracking-wider">
            {order.order_number}
          </span>
          <button
            type="button"
            onClick={handleCopyOrderNumber}
            className="p-1 rounded-lg bg-white text-zinc-600 hover:text-zinc-900 shadow-2xs transition-colors cursor-pointer"
            title="Copier le numéro"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* WhatsApp Direct Action Button */}
        <div className="pt-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold bg-[#25D366] text-white shadow-md hover:brightness-105 active:scale-98 transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Confirmer ma commande sur WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Order Details Breakdown */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-6">
        <h2 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-3">
          Détail des articles commandés
        </h2>

        <ul className="divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-bold text-zinc-900">{item.product_title}</p>
                {item.variant_title && (
                  <p className="text-[11px] text-zinc-500">{item.variant_title}</p>
                )}
                <p className="text-[11px] text-zinc-400">
                  {item.quantity} × {formatPriceXaf(item.unit_price_xaf)}
                </p>
              </div>
              <span className="font-bold text-zinc-900">
                {formatPriceXaf(item.total_price_xaf)}
              </span>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <div className="border-t border-zinc-200/80 pt-4 space-y-2 text-xs text-zinc-600">
          <div className="flex justify-between">
            <span>Sous-total articles</span>
            <span className="font-bold text-zinc-900">{formatPriceXaf(order.subtotal_xaf)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frais de livraison ({order.delivery_method === 'pickup' ? 'Retrait sur place' : 'Livraison à domicile'})</span>
            <span className="font-bold text-zinc-900">
              {order.delivery_fee_xaf > 0 ? formatPriceXaf(order.delivery_fee_xaf) : 'Gratuit'}
            </span>
          </div>
          <div className="border-t border-zinc-200 pt-3 flex justify-between text-base font-black text-zinc-950">
            <span>Total TTC réglé / à régler</span>
            <span style={{ color: themeColor }}>{formatPriceXaf(order.total_amount_xaf)}</span>
          </div>
        </div>
      </div>

      {/* Delivery & Payment Recap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Delivery */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-zinc-900">
            {order.delivery_method === 'pickup' ? (
              <Building className="h-4 w-4 text-blue-600" />
            ) : (
              <Truck className="h-4 w-4 text-emerald-600" />
            )}
            <span>Livraison</span>
          </div>
          <p className="text-zinc-600">
            {order.delivery_method === 'pickup'
              ? 'Retrait sur place en boutique'
              : order.delivery_address || 'Adresse indiquée lors de la commande'}
          </p>
          <p className="text-[11px] text-zinc-400">Client : {order.customer_name} ({order.customer_phone})</p>
        </div>

        {/* Payment */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-zinc-900">
            <CreditCard className="h-4 w-4 text-amber-600" />
            <span>Paiement</span>
          </div>
          <p className="text-zinc-600">
            {order.payment_method === 'cash_on_delivery'
              ? 'Paiement à la livraison'
              : order.payment_method === 'pickup'
              ? 'Paiement au retrait en boutique'
              : 'Mobile Money Manuel'}
          </p>
          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span>Statut : {order.payment_status === 'paid' ? 'Payé' : 'En attente de vérification'}</span>
          </p>
        </div>
      </div>

      {/* Next Steps */}
      <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-2">
        <p className="font-bold text-zinc-900">Prochaines étapes :</p>
        <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-500">
          <li>Le commerçant prépare votre commande.</li>
          <li>Un livreur vous contacte par téléphone ou WhatsApp avant le passage.</li>
          <li>Vous réceptionnez et réglez votre colis en toute confiance.</li>
        </ol>
      </div>

      <div className="text-center pt-2">
        <Link
          href={`/store/${storeSlug}`}
          className="text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          ← Retour à l’accueil de la boutique
        </Link>
      </div>
    </div>
  );
}
