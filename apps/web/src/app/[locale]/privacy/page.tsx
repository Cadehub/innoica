import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export default async function PrivacyPage({
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
          <BrandLogo subtitle={isFr ? 'Confidentialité' : 'Privacy'} />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{isFr ? 'Conformité RGPD & Protection des Données' : 'GDPR & Privacy Compliance'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
            {isFr ? 'Politique de Confidentialité & Traitement des Données' : 'Privacy & Data Protection Policy'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2 font-mono">
            {isFr ? 'Dernière mise à jour : 16 Novembre 2026' : 'Last updated: November 16, 2026'}
          </p>
        </div>

        <div className="prose prose-zinc prose-sm sm:prose-base max-w-none space-y-8 text-zinc-700 leading-relaxed">
          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">1</span>
              <span>{isFr ? 'Introduction & Identité du Responsable de Traitement' : 'Introduction & Data Controller'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "La présente Politique de Confidentialité régit la manière dont INNOICA (« nous », « notre » ou « la Plateforme ») collecte, traite, stocke et protège les données à caractère personnel dans le cadre de ses services SaaS d'agents d'intelligence artificielle sur WhatsApp."
                : "This Privacy Policy governs how INNOICA ('we', 'our' or 'the Platform') collects, processes, stores, and protects personal data within our WhatsApp AI agent SaaS services."}
            </p>
            <p className="text-sm">
              {isFr
                ? "Conformément au Règlement Général sur la Protection des Données (RGPD 2016/679) et aux législations applicables en matière de télécommunications, INNOICA agit en qualité de Sous-traitant technique (Data Processor) pour le compte de ses utilisateurs (Data Controllers) qui déploient des agents conversationnels auprès de leur propre clientèle."
                : "In accordance with the General Data Protection Regulation (GDPR 2016/679) and applicable telecommunication laws, INNOICA acts as a Technical Data Processor on behalf of its users (Data Controllers) deploying AI agents to their own end-customers."}
            </p>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">2</span>
              <span>{isFr ? 'Données Collectées et Finalités' : 'Collected Data and Purposes'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? "Nous collectons strictement les données nécessaires au bon fonctionnement de la plateforme :"
                : "We strictly collect data necessary for the operation of the platform:"}
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-zinc-600">
              <li>
                <strong>{isFr ? 'Compte Utilisateur :' : 'User Account:'}</strong>{' '}
                {isFr ? 'Nom, adresse e-mail professionnelle, identifiant unique de workspace, mot de passe haché.' : 'Name, business email address, unique workspace identifier, hashed password.'}
              </li>
              <li>
                <strong>{isFr ? 'Connexions WhatsApp :' : 'WhatsApp Connections:'}</strong>{' '}
                {isFr ? 'Numéro de téléphone d’association, clés de session cryptographiques locales chiffrées nécessaires à la reconnexion Baileys.' : 'Phone pairing number, local cryptographic session keys encrypted for Baileys reconnection.'}
              </li>
              <li>
                <strong>{isFr ? 'Clés d’API des Fournisseurs d’IA (BYOK) :' : 'AI Provider API Keys (BYOK):'}</strong>{' '}
                {isFr ? 'Vos clés d’API privées (Groq, OpenAI, Anthropic) sont chiffrées au repos via AES-256-GCM. Elles ne sont jamais stockées en clair ni réutilisées pour un autre workspace.' : 'Your private API keys (Groq, OpenAI, Anthropic) are encrypted at rest with AES-256-GCM. They are never stored in plaintext.'}
              </li>
              <li>
                <strong>{isFr ? 'Messages et Connaissances :' : 'Messages and Knowledge Base:'}</strong>{' '}
                {isFr ? 'Documents FAQ, textes et URLs fournis par l’utilisateur pour entraîner l’agent, ainsi que l’historique des échanges WhatsApp permettant l’intervention du superviseur humain.' : 'FAQ documents, texts, and URLs provided to train the agent, along with WhatsApp interaction logs enabling human supervision.'}
              </li>
            </ul>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">3</span>
              <span>{isFr ? 'Sécurité & Chiffrement de Bout en Bout' : 'Security & Encryption'}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <Lock className="h-4 w-4 text-emerald-600 mb-1" />
                <h4 className="font-semibold text-zinc-900 text-xs">{isFr ? 'Chiffrement AES-256-GCM' : 'AES-256-GCM Encryption'}</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  {isFr ? 'Chiffrement militaire des jetons secrets et clés BYOK avec vecteur d’initialisation unique.' : 'Military-grade encryption for secret tokens and BYOK credentials.'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <ShieldCheck className="h-4 w-4 text-blue-600 mb-1" />
                <h4 className="font-semibold text-zinc-900 text-xs">{isFr ? 'Isolation RLS Stricte' : 'Strict RLS Isolation'}</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  {isFr ? 'Row Level Security dans PostgreSQL : chaque workspace est rigoureusement hermétique.' : 'Row Level Security in PostgreSQL: workspaces are strictly sandboxed.'}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-600">
              {isFr
                ? 'INNOICA s’engage à ne jamais vendre, louer, ou transmettre vos données personnelles ni les conversations de vos clients à des régies publicitaires ou tiers non autorisés. Vos données ne sont jamais utilisées pour entraîner des modèles d’IA publics.'
                : 'INNOICA commits to never sell, rent, or transfer your personal data or your customers’ conversations to advertising networks or unauthorized third parties. Your data is never used to train public AI models.'}
            </p>
          </section>

          <section className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white text-xs font-mono">4</span>
              <span>{isFr ? 'Vos Droits Informatique & Libertés' : 'Your Rights'}</span>
            </h2>
            <p className="text-sm">
              {isFr
                ? 'Conformément au RGPD (articles 15 à 22), vous disposez des droits suivants à tout moment :'
                : 'In accordance with GDPR (Articles 15 to 22), you retain the following rights at any time:'}
            </p>
            <ul className="text-sm space-y-1.5 list-disc list-inside text-zinc-600">
              <li>{isFr ? 'Droit d’accès et d’exportation de l’ensemble de vos données.' : 'Right of access and export for all your data.'}</li>
              <li>{isFr ? 'Droit de rectification immédiate des informations erronées.' : 'Right to rectification of inaccurate information.'}</li>
              <li>{isFr ? 'Droit à l’effacement définitif (« Droit à l’oubli ») de vos agents, connaissances et sessions.' : 'Right to complete erasure of your agents, knowledge base, and sessions.'}</li>
              <li>{isFr ? 'Droit à la limitation du traitement et opposition.' : 'Right to restriction of processing and objection.'}</li>
            </ul>
            <p className="text-sm">
              {isFr
                ? 'Pour exercer ces droits, contactez notre Délégué à la Protection des Données (DPO) à : '
                : 'To exercise these rights, please contact our Data Protection Officer (DPO) at: '}
              <a href="mailto:privacy@innoica.com" className="font-semibold text-blue-600 hover:underline">
                privacy@innoica.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
