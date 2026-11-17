import React from 'react';
import Link from 'next/link';
import { ShoppingBag, Sparkles, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

interface CommercePlanRequiredGateProps {
  currentPlan?: string;
  locale?: 'fr' | 'en';
}

export function CommercePlanRequiredGate({
  currentPlan = 'free',
  locale = 'fr',
}: CommercePlanRequiredGateProps) {
  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 antialiased">
      <div className="p-8 sm:p-10 rounded-3xl bg-white border border-zinc-200/80 shadow-sm text-center space-y-6">
        {/* Icon & Badge */}
        <div className="space-y-3">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-md">
            <ShoppingBag className="h-8 w-8 text-[#25D366]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Offre INNOICA Commerce</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Débloquez votre Boutique E-Commerce & Constructeur Visuel
          </h1>

          <p className="text-xs sm:text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
            La vitrine en ligne, le constructeur visuel de boutique et la gestion des commandes
            nécessitent le forfait <strong className="text-zinc-800">INNOICA Commerce</strong> à <strong>6 500 FCFA/mois</strong>.
          </p>
        </div>

        {/* Feature List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto pt-2">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-zinc-900 block">Vitrine Publique Oraimo-style</strong>
              <span className="text-zinc-500">Expérience mobile ultra-rapide et responsive</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-zinc-900 block">Constructeur Visuel Intégré</strong>
              <span className="text-zinc-500">Personnalisez couleurs, bannières et sections sans code</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-zinc-900 block">Paiements Manuels & Cash</strong>
              <span className="text-zinc-500">Paiement à la livraison, retrait et Mobile Money</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="text-zinc-900 block">Synchronisation WhatsApp</strong>
              <span className="text-zinc-500">Catalogue en temps réel et notifications de commande</span>
            </div>
          </div>
        </div>

        {/* Pricing & CTA */}
        <div className="pt-4 space-y-3">
          <div className="inline-flex items-baseline gap-1.5 text-zinc-900">
            <span className="text-3xl font-black">6 500</span>
            <span className="text-xs font-bold text-zinc-500">FCFA / mois</span>
          </div>

          <div>
            <Link
              href="/subscription?plan=commerce"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm bg-zinc-900 hover:bg-zinc-800 shadow-md active:scale-98 transition-all"
            >
              <span>Passer à INNOICA Commerce</span>
              <ArrowRight className="h-4 w-4 text-[#25D366]" />
            </Link>
          </div>

          <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
            <span>Paiement sécurisé par Orange Money, MTN MoMo ou carte</span>
          </p>
        </div>
      </div>
    </div>
  );
}
