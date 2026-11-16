import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export default async function TermsPage({
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
          <BrandLogo subtitle={isFr ? 'Conditions Légales' : 'Terms of Service'} />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200 mb-4">
            <Scale className="h-3.5 w-3.5" />
            <span>{isFr ? 'Contrat d’Utilisation & Cadre Juridique' : 'Terms & Legal Agreement'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
            {isFr ? 'Conditions Générales d’Utilisation et de Vente (CGU / CGV)' : 'Terms of Service & General Conditions'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2 font-mono">
            {isFr ? 'En vigueur à compter du 16 Novembre 2026' : 'Effective as of November 16, 2026'}
          </p>
        </div>

        <div className="prose prose-zinc prose-sm sm:prose-base max-w-none space-y-8 text-zinc-700 leading-relaxed">
          {/* Avertissement Meta / WhatsApp Impératif */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{isFr ? 'CLAUSE IMPORTANTE : AVIS DE NON-AFFILIATION AVEC META PLATFORMS' : 'CRITICAL DISCLAIMER: NON-AFFILIATION WITH META PLATFORMS'}</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              {isFr
                ? 'INNOICA est une solution logicielle tierce indépendante exploitant des protocoles open-source. INNOICA n’est en aucun cas affiliée, associée, autorisée, sponsorisée ou approuvée par Meta Platforms, Inc. ou WhatsApp LLC. La marque WhatsApp ainsi que les logos associés sont la propriété exclusive de Meta Platforms, Inc.'
                : 'INNOICA is an independent third-party software solution using open-source protocols. INNOICA is in no way affiliated, associated, authorized, sponsored, or endorsed by Meta Platforms, Inc. or WhatsApp LLC. WhatsApp and associated marks are trademarks of Meta Platforms, Inc.'}
            </p>
          </div>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">1</span>
              <span>{isFr ? 'Objet et Acceptation du Service' : 'Scope and Acceptance'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "L'accès et l'utilisation de la plateforme INNOICA Agent Studio impliquent l'acceptation pleine, entière et sans réserve des présentes conditions par l'utilisateur. Toute inscription sur la plateforme emporte adhésion expresse au présent contrat."
                : "Access to and use of INNOICA Agent Studio implies full and unconditional acceptance of these terms by the user. Registering on the platform constitutes express consent to this agreement."}
            </p>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">2</span>
              <span>{isFr ? 'Politique Anti-Spam & Obligations de l’Utilisateur' : 'Anti-Spam Policy & User Obligations'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "L'utilisateur s'engage formellement et sous sa seule responsabilité juridique à :"
                : "The user expressly and under sole legal liability agrees to:"}
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-zinc-600">
              <li>
                <strong>{isFr ? 'Interdiction formelle du spam :' : 'Zero Spam Tolerance:'}</strong>{' '}
                {isFr
                  ? "Ne jamais utiliser les agents INNOICA pour l'envoi de messages non sollicités, de démarchage à froid sans consentement explicite (opt-in), de harcèlement, de phishing ou d'activités frauduleuses."
                  : 'Never use INNOICA agents for unsolicited messaging, mass spam, harassment, phishing, or fraudulent schemes.'}
              </li>
              <li>
                <strong>{isFr ? 'Respect des politiques WhatsApp :' : 'WhatsApp Policy Compliance:'}</strong>{' '}
                {isFr
                  ? "Se conformer strictement aux conditions d'utilisation de WhatsApp Business et du service de messagerie de Meta."
                  : 'Strictly adhere to WhatsApp Business Terms and Meta communication policies.'}
              </li>
              <li>
                <strong>{isFr ? 'Sanction immédiate :' : 'Immediate Termination:'}</strong>{' '}
                {isFr
                  ? "En cas de plainte, de comportement abusif ou de violation des lois anti-spam, INNOICA procèdera à la clôture immédiate et sans indemnité du compte de l'utilisateur."
                  : 'In the event of verified spam or policy violation, INNOICA reserves the right to immediately terminate the account without refund or prior notice.'}
              </li>
            </ul>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">3</span>
              <span>{isFr ? 'Exonération Totale de Responsabilité' : 'Limitation of Liability'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "DANS LES LIMITES MAXIMALES AUTORISÉES PAR LA LOI, INNOICA NE POURRA EN AUCUN CAS ÊTRE TENU RESPONSABLE :"
                : "TO THE FULLEST EXTENT PERMITTED BY LAW, INNOICA SHALL NOT BE LIABLE FOR:"}
            </p>
            <ul className="text-sm space-y-1.5 list-disc list-inside text-zinc-600">
              <li>{isFr ? 'Du bannissement, blocage ou suspension d’un numéro WhatsApp par Meta Platforms, Inc.' : 'Any banning, suspension, or limitation of a WhatsApp phone number by Meta Platforms, Inc.'}</li>
              <li>{isFr ? 'De l’exactitude ou des erreurs (« hallucinations ») générées par les modèles d’intelligence artificielle sous-jacents (Groq, OpenAI, Anthropic, etc.).' : 'Inaccuracies, errors, or hallucinations produced by third-party AI models (Groq, OpenAI, Anthropic, etc.).'}</li>
              <li>{isFr ? 'Des pannes des réseaux de télécommunication, hébergeurs cloud ou coupures d’API tierces.' : 'Telecommunication carrier outages, third-party cloud downtime, or upstream API service interruptions.'}</li>
              <li>{isFr ? 'Des pertes de chiffre d’affaires, manques à gagner ou préjudices commerciaux indirects.' : 'Loss of profits, business interruption, or consequential indirect damages.'}</li>
            </ul>
            <p className="text-xs text-zinc-500 italic mt-2">
              {isFr
                ? "L'utilisateur reconnaît que l'IA conversationnelle constitue une assistance d'automatisation nécessitant une supervision humaine via le mode « Reprise Humaine » mis à sa disposition dans le studio."
                : "The user acknowledges that AI conversational agents serve as automation assistants requiring human oversight via the 'Human Takeover' mode provided in the studio."}
            </p>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">4</span>
              <span>{isFr ? 'Tarification, Abonnements & Paiements' : 'Pricing, Subscriptions & Billing'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "Les tarifs des forfaits (Starter, Pro, Agency) sont affichés en Francs CFA (XAF) et devises équivalentes. Conformément aux dispositions régissant les services numériques fournis immédiatement, aucun droit de rétractation ne peut être exercé une fois les crédits ou le forfait activés sur le workspace."
                : "Subscription plans (Starter, Pro, Agency) are priced in FCFA (XAF) and equivalent currencies. In accordance with digital service regulations, no statutory withdrawal right applies once workspace resources are activated."}
            </p>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">5</span>
              <span>{isFr ? 'Loi Applicable & Règlement des Litiges' : 'Governing Law & Jurisdiction'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "Les présentes conditions sont soumises au droit commercial applicable. Tout différend relatif à l'interprétation ou à l'exécution du contrat sera soumis en priorité à une conciliation amiable avant toute saisine des juridictions compétentes."
                : "These terms are governed by applicable commercial law. Any dispute arising out of or in connection with this agreement shall first seek amicable resolution before submission to competent courts."}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
