import React from 'react';

export interface CommerceMetrics {
  activeStores: number;
  totalProducts: number;
  orders30d: number;
  orders7d: number;
  gmv30dXaf: number;
  cancelled30d: number;
  commerceWorkspaces: number;
  agentWorkspaces: number;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/**
 * Privacy-preserving platform metrics: aggregates only.
 * No customer identity, no per-merchant order content is ever exposed here.
 */
export function CommerceMetricsCard({ metrics }: { metrics: CommerceMetrics | null }) {
  if (!metrics) return null;

  const items: Array<{ label: string; value: string }> = [
    { label: 'Offres Commerce actives', value: String(metrics.commerceWorkspaces) },
    { label: 'Offres Agent actives', value: String(metrics.agentWorkspaces) },
    { label: 'Boutiques en ligne', value: String(metrics.activeStores) },
    { label: 'Produits actifs', value: String(metrics.totalProducts) },
    { label: 'Commandes (7 j)', value: String(metrics.orders7d) },
    { label: 'Commandes (30 j)', value: String(metrics.orders30d) },
    { label: 'Annulées (30 j)', value: String(metrics.cancelled30d) },
    { label: 'Volume de ventes (30 j)', value: fcfa(metrics.gmv30dXaf) },
  ];

  return (
    <section aria-label="Métriques e-commerce" className="mb-6 p-5 rounded-2xl bg-white border border-zinc-200/80">
      <h2 className="text-sm font-black text-zinc-900">E-commerce — vue d’ensemble de la plateforme</h2>
      <p className="text-[11px] text-zinc-500 mt-0.5">
        Données agrégées uniquement. Aucune donnée client ni détail de commande n’est affiché.
      </p>
      <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => (
          <div key={it.label} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <dt className="text-[10px] text-zinc-500">{it.label}</dt>
            <dd className="text-lg font-black text-zinc-900">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
