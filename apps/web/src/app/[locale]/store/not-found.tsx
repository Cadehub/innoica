import Link from 'next/link';
import { Store, ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export default function StoreGlobalNotFound() {
  return (
    <div className="min-h-screen bg-[#fafafb] flex flex-col items-center justify-center p-4 antialiased selection:bg-zinc-900 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-8 text-center animate-fade-in-up">
        <div className="flex justify-center mb-6">
          <BrandLogo size="md" />
        </div>

        <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-zinc-100 border border-zinc-200/70 flex items-center justify-center text-zinc-400">
          <Store className="h-8 w-8 text-zinc-500" />
        </div>

        <h1 className="text-xl font-bold text-zinc-900 mb-2">
          Boutique introuvable ou indisponible
        </h1>

        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          L'adresse de cette boutique est incorrecte ou le commerçant l'a temporairement désactivée.
          Veuillez vérifier l'adresse URL ou contacter le vendeur via WhatsApp.
        </p>

        <div className="space-y-2.5">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil INNOICA
          </Link>
          <p className="text-[11px] text-zinc-400 pt-2">
            Propulsé par <span className="font-semibold text-zinc-600">INNOICA Commerce</span>
          </p>
        </div>
      </div>
    </div>
  );
}
