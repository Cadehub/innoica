import Link from 'next/link';
import { PackageSearch, ArrowLeft, ShoppingBag } from 'lucide-react';

export default function StoreProductNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200/80 shadow-xs p-8 animate-fade-in-up">
        <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-zinc-50 border border-zinc-200/70 flex items-center justify-center text-zinc-400">
          <PackageSearch className="h-8 w-8 text-zinc-500" />
        </div>

        <h2 className="text-lg font-bold text-zinc-900 mb-2">
          Produit ou article introuvable
        </h2>

        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          Le produit recherché n'existe pas ou n'est plus proposé dans cette boutique.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="./"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--store-theme, #25D366)' }}
          >
            <ShoppingBag className="h-4 w-4" />
            Voir tous les produits
          </Link>
          <Link
            href="./"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Accueil boutique
          </Link>
        </div>
      </div>
    </div>
  );
}
