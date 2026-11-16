import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Server, ShieldCheck, Mail } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isFr = locale === 'fr';

  return (
    <div className="min-h-screen bg-[#fafafb] text-zinc-900 selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>{isFr ? 'Retour à l’accueil' : 'Back to home'}</span>
          </Link>
          <BrandLogo subtitle={isFr ? 'Mentions Légales' : 'Legal Notices'} />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold border border-zinc-200 mb-4">
            <Building2 className="h-3.5 w-3.5 text-zinc-600" />
            <span>{isFr ? 'Informations Juridiques & Réglementaires' : 'Legal & Corporate Notices'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
            {isFr ? 'Mentions Légales' : 'Legal Notice'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2 font-mono">
            {isFr ? 'Dernière mise à jour : 16 Novembre 2026' : 'Last updated: November 16, 2026'}
          </p>
        </div>

        <div className="prose prose-zinc prose-sm sm:prose-base max-w-none space-y-8 text-zinc-700 leading-relaxed">
          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-zinc-700" />
              <span>{isFr ? 'Éditeur de la Plateforme' : 'Publisher Information'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "La plateforme logicielle INNOICA Agent Studio est éditée et exploitée par :"
                : 'INNOICA Agent Studio software platform is published and operated by:'}
            </p>
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 font-mono text-xs space-y-1 text-zinc-800">
              <p><strong>Dénomination :</strong> INNOICA Technologies</p>
              <p><strong>Activité :</strong> Édition de logiciels SaaS, solutions d'intelligence artificielle et intégrations CRM.</p>
              <p><strong>Contact général :</strong> contact@innoica.com</p>
              <p><strong>Contact juridique & DPO :</strong> legal@innoica.com</p>
            </div>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Server className="h-5 w-5 text-zinc-700" />
              <span>{isFr ? 'Hébergement de l’Infrastructure' : 'Infrastructure Hosting'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "Les données et services de la plateforme sont hébergés sur des infrastructures certifiées hautement sécurisées :"
                : 'Platform data and services are hosted on certified, highly secure cloud infrastructures:'}
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-zinc-600">
              <li>
                <strong>Base de données & Auth :</strong> Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 (Chiffrement au repos, réplication et RLS certifié SOC2 Type II).
              </li>
              <li>
                <strong>Infrastructure Serveurs & Workers :</strong> Centres de données sécurisés conformes aux normes ISO/IEC 27001 et RGPD.
              </li>
            </ul>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-zinc-700" />
              <span>{isFr ? 'Propriété Intellectuelle' : 'Intellectual Property'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "L'ensemble des éléments constituant le site et la plateforme (textes, graphismes, logiciels, architectures, logos, icônes, sons) sont la propriété exclusive d'INNOICA Technologies ou font l'objet d'une licence d'exploitation régulière. Toute reproduction, représentation, modification ou diffusion, totale ou partielle, sans autorisation préalable expresse est strictement interdite et sanctionnée par le code de la propriété intellectuelle."
                : 'All elements comprising the platform (text, graphics, software, code, logos, icons, audio) are the exclusive property of INNOICA Technologies or licensed under appropriate agreements. Any unauthorized reproduction, modification, or distribution is strictly prohibited under applicable intellectual property laws.'}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
