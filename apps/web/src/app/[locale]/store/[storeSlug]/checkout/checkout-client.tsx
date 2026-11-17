'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Truck,
  Building,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { useCart } from '@/components/store/cart-context';
import { formatPriceXaf } from '@/lib/utils';
import { cameroonPhoneRegex } from '@innoica/shared';

export interface DeliveryZoneOption {
  id: string;
  name: string;
  fee_xaf: number;
  estimated_delivery_time?: string | null;
  allows_pickup: boolean;
}

interface CheckoutClientProps {
  storeSlug: string;
  storeName: string;
  deliveryZones: DeliveryZoneOption[];
  themeColor?: string;
  merchantDescription?: string | null;
}

export function CheckoutClient({
  storeSlug,
  storeName,
  deliveryZones = [],
  themeColor = '#25D366',
  merchantDescription = '',
}: CheckoutClientProps) {
  const router = useRouter();
  const { items, subtotalXaf, cartToken, clearCart } = useCart();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+237');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    deliveryZones.length > 0 ? deliveryZones[0].id : ''
  );
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<
    'cash_on_delivery' | 'pickup' | 'manual_mobile_money'
  >('cash_on_delivery');
  const [manualPaymentPhone, setManualPaymentPhone] = useState('');
  const [manualPaymentRef, setManualPaymentRef] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Delivery Zone & Fee
  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId) || null;
  const deliveryFee = deliveryMethod === 'delivery' ? (selectedZone ? selectedZone.fee_xaf : 0) : 0;
  const totalAmount = subtotalXaf + deliveryFee;

  // Validation
  const validateForm = (): string | null => {
    if (!customerName.trim() || customerName.trim().length < 2) {
      return 'Veuillez saisir votre nom complet (au moins 2 caractères).';
    }

    const cleanPhone = customerPhone.replace(/[\s.-]/g, '').trim();
    if (!cameroonPhoneRegex.test(cleanPhone)) {
      return 'Veuillez saisir un numéro de téléphone camerounais valide (ex: +237 6XXXXXXXX ou 6XXXXXXXX).';
    }

    if (deliveryMethod === 'delivery') {
      if (!deliveryAddress.trim() || deliveryAddress.trim().length < 3) {
        return 'Veuillez indiquer une adresse de livraison précise (quartier, rue, repère).';
      }
    }

    if (paymentMethod === 'manual_mobile_money') {
      if (!manualPaymentPhone.trim() || manualPaymentPhone.trim().length < 6) {
        return 'Veuillez indiquer le numéro de téléphone utilisé pour le transfert Mobile Money.';
      }
      if (!manualPaymentRef.trim() || manualPaymentRef.trim().length < 3) {
        return 'Veuillez indiquer l’ID de transaction ou la référence du transfert reçu par SMS.';
      }
    }

    if (items.length === 0) {
      return 'Votre panier est vide. Veuillez ajouter au moins un produit avant de commander.';
    }

    return null;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const error = validateForm();
    if (error) {
      setErrorMessage(error);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderPayload = {
        storeSlug,
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/[\s.-]/g, '').trim(),
        customerEmail: customerEmail.trim() || null,
        deliveryMethod,
        deliveryZoneId: deliveryMethod === 'delivery' ? selectedZoneId || null : null,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : null,
        deliveryNotes: deliveryNotes.trim() || null,
        paymentMethod,
        manualPaymentPhone:
          paymentMethod === 'manual_mobile_money' ? manualPaymentPhone.trim() : null,
        manualPaymentRef:
          paymentMethod === 'manual_mobile_money' ? manualPaymentRef.trim() : null,
        cartToken: cartToken || null,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId || null,
          quantity: it.quantity,
        })),
      };

      const res = await fetch(`/api/store/${storeSlug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Une erreur est survenue lors de la commande.');
      }

      // Order created successfully
      const orderNumber = data.order?.orderNumber || data.order?.order_number;
      clearCart();
      router.push(`/store/${storeSlug}/order-confirmation/${orderNumber}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec de la validation. Veuillez réessayer.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 antialiased">
        <div className="h-16 w-16 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
          <Truck className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Votre panier est vide</h1>
        <p className="text-xs text-zinc-500">
          Vous devez ajouter des articles à votre panier avant de pouvoir passer commande.
        </p>
        <Link
          href={`/store/${storeSlug}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs"
          style={{ backgroundColor: themeColor }}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Retour à la boutique</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 antialiased">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href={`/store/${storeSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Continuer mes achats</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Checkout Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
              Finaliser ma commande
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Commande express sans inscription obligatoire. Renseignez vos coordonnées ci-dessous.
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmitOrder} className="space-y-6">
            {/* 1. Informations Personnelles */}
            <section className="p-5 sm:p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-sm font-bold text-zinc-900">Informations de Contact</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-700">
                    Nom & Prénom <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Marc Nkoa"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">
                    Numéro WhatsApp / Téléphone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+237 6XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Réseaux acceptés : Orange, MTN, Nexttel, Camtel
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">
                    Adresse Email (facultatif)
                  </label>
                  <input
                    type="email"
                    placeholder="Pour recevoir votre reçu"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
              </div>
            </section>

            {/* 2. Mode de Livraison */}
            <section className="p-5 sm:p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-sm font-bold text-zinc-900">Mode de Livraison</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    deliveryMethod === 'delivery'
                      ? 'border-zinc-950 bg-zinc-50/70 shadow-2xs'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="delivery"
                    checked={deliveryMethod === 'delivery'}
                    onChange={() => {
                      setDeliveryMethod('delivery');
                      if (paymentMethod === 'pickup') {
                        setPaymentMethod('cash_on_delivery');
                      }
                    }}
                    className="mt-1 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      Livraison à Domicile
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">
                      Expédition par coursier express à votre adresse
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    deliveryMethod === 'pickup'
                      ? 'border-zinc-950 bg-zinc-50/70 shadow-2xs'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="pickup"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => setDeliveryMethod('pickup')}
                    className="mt-1 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block flex items-center gap-1.5">
                      <Building className="h-4 w-4" />
                      Retrait en Boutique (Gratuit)
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">
                      0 FCFA • Retrait direct auprès du commerçant
                    </span>
                  </div>
                </label>
              </div>

              {deliveryMethod === 'delivery' ? (
                <div className="space-y-3 pt-2">
                  {deliveryZones.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700">
                        Zone de livraison <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs bg-white text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 cursor-pointer"
                      >
                        {deliveryZones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} — {formatPriceXaf(z.fee_xaf)}{' '}
                            {z.estimated_delivery_time ? `[${z.estimated_delivery_time}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">
                      Adresse de livraison complète <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Quartier, rue, carrefour, nom de l'immeuble ou repère précis..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700">
                      Instructions pour le livreur (facultatif)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Appeler avant d'arriver, barrière noire..."
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-1">
                  <p className="font-bold text-zinc-800">Point de retrait de la boutique :</p>
                  <p>{merchantDescription || 'Point de vente officiel — Contactez la boutique pour l’adresse exacte'}</p>
                  <p className="text-[11px] text-zinc-400">
                    Frais de livraison : <span className="font-bold text-emerald-600">0 FCFA</span>
                  </p>
                </div>
              )}
            </section>

            {/* 3. Mode de Paiement */}
            <section className="p-5 sm:p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <span className="h-6 w-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-sm font-bold text-zinc-900">Mode de Paiement</h2>
              </div>

              <div className="space-y-2.5">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'cash_on_delivery'
                      ? 'border-zinc-950 bg-zinc-50/70 shadow-2xs'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash_on_delivery"
                    checked={paymentMethod === 'cash_on_delivery'}
                    onChange={() => setPaymentMethod('cash_on_delivery')}
                    className="mt-1 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      Paiement à la Livraison (Cash ou Mobile Money au livreur)
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">
                      Réglez en toute sérénité lors de la réception de votre colis.
                    </span>
                  </div>
                </label>

                {deliveryMethod === 'pickup' && (
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'pickup'
                        ? 'border-zinc-950 bg-zinc-50/70 shadow-2xs'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="pickup"
                      checked={paymentMethod === 'pickup'}
                      onChange={() => setPaymentMethod('pickup')}
                      className="mt-1 text-zinc-900 focus:ring-zinc-900"
                    />
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block flex items-center gap-1.5">
                        <Building className="h-4 w-4 text-blue-600" />
                        Paiement au Retrait en Boutique
                      </span>
                      <span className="text-[11px] text-zinc-500 block mt-0.5">
                        Réglez directement au comptoir lors de votre passage.
                      </span>
                    </div>
                  </label>
                )}

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'manual_mobile_money'
                      ? 'border-zinc-950 bg-zinc-50/70 shadow-2xs'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="manual_mobile_money"
                    checked={paymentMethod === 'manual_mobile_money'}
                    onChange={() => setPaymentMethod('manual_mobile_money')}
                    className="mt-1 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-amber-600" />
                      Transfert Mobile Money Manuel (Orange / MTN)
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">
                      Effectuez votre transfert puis renseignez la référence SMS de validation.
                    </span>
                  </div>
                </label>
              </div>

              {/* Mobile Money Payment Instructions Card */}
              {paymentMethod === 'manual_mobile_money' && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-3 animate-fade-in">
                  <div className="space-y-1">
                    <p className="font-bold text-amber-900">Comptes Marchands Officiels :</p>
                    <ul className="space-y-1 text-amber-800 text-[11px]">
                      <li>• <strong>Orange Money</strong> : Renseigné par le commerçant à la commande</li>
                      <li>• <strong>MTN MoMo</strong> : Renseigné par le commerçant à la commande</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-amber-950">
                        Votre numéro émetteur <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+237 6XXXXXXXX"
                        value={manualPaymentPhone}
                        onChange={(e) => setManualPaymentPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-amber-950">
                        Référence de transaction / SMS <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: MP261117.1234.A001"
                        value={manualPaymentRef}
                        onChange={(e) => setManualPaymentRef(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Mobile Submit Button */}
            <div className="lg:hidden">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:brightness-105 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: themeColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validation en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmer la commande ({formatPriceXaf(totalAmount)})</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Order Review Sidebar (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 p-5 sm:p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">
              Récapitulatif ({items.length} article{items.length > 1 ? 's' : ''})
            </h2>

            {/* Items list */}
            <ul className="divide-y divide-zinc-100 max-h-64 overflow-y-auto studio-scroll">
              {items.map((item) => (
                <li
                  key={`${item.productId}-${item.variantId || 'base'}`}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-zinc-900 truncate">{item.title}</p>
                    {item.variantTitle && (
                      <p className="text-[11px] text-zinc-500 truncate">{item.variantTitle}</p>
                    )}
                    <p className="text-[11px] text-zinc-400">Quantité : {item.quantity}</p>
                  </div>
                  <span className="font-bold text-zinc-900 shrink-0">
                    {formatPriceXaf(item.priceXaf * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Price Calculations */}
            <div className="border-t border-zinc-200/80 pt-3 space-y-2 text-xs text-zinc-600">
              <div className="flex justify-between">
                <span>Sous-total articles</span>
                <span className="font-bold text-zinc-900">{formatPriceXaf(subtotalXaf)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frais de livraison</span>
                <span className="font-bold text-zinc-900">
                  {deliveryFee > 0 ? formatPriceXaf(deliveryFee) : 'Gratuit (0 FCFA)'}
                </span>
              </div>
              <div className="border-t border-zinc-200 pt-3 flex justify-between text-base font-black text-zinc-950">
                <span>Total TTC à payer</span>
                <span style={{ color: themeColor }}>{formatPriceXaf(totalAmount)}</span>
              </div>
            </div>

            {/* Desktop Submit Button */}
            <div className="hidden lg:block pt-2">
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:brightness-105 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: themeColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validation en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmer la commande</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 text-center pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Commande sécurisée enregistrée en direct sur INNOICA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
