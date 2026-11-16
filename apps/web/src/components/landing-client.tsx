'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import {
  ArrowRight,
  Bot,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe,
  Headphones,
  KeyRound,
  Lock,
  MessageSquare,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Utensils,
  Zap,
  Play,
  RotateCcw,
  Sliders,
  Award,
  Layers,
  Database,
  Search,
  Send,
  User,
  Radio,
  FileText,
  Link2,
  TrendingUp,
  Brain,
  Plus,
  Menu,
  X,
} from 'lucide-react';

interface LandingClientProps {
  locale: 'fr' | 'en';
  isAuthenticated: boolean;
}

export function LandingClient({ locale, isAuthenticated }: LandingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isEn = locale === 'en';

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activeStudioTab, setActiveStudioTab] = useState<'inbox' | 'pairing' | 'knowledge'>('inbox');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Gamification & Simulator State
  const [simPersona, setSimPersona] = useState<'commerce' | 'agency' | 'booking' | 'restaurant'>('commerce');
  const [simMode, setSimMode] = useState<'ai' | 'takeover'>('ai');
  const [simAudioPlaying, setSimAudioPlaying] = useState(false);
  const [conversationsPerDay, setConversationsPerDay] = useState(45);
  const [minsPerConv, setMinsPerConv] = useState(4);
  const [operatorMonthlyCost, setOperatorMonthlyCost] = useState(120000); // 120,000 FCFA

  // Achieved Badges State
  const [unlockedBadges, setUnlockedBadges] = useState<{
    testedVocal: boolean;
    testedTakeover: boolean;
    testedPairing: boolean;
    calculatedRoi: boolean;
  }>({
    testedVocal: false,
    testedTakeover: false,
    testedPairing: false,
    calculatedRoi: true,
  });

  const switchLocale = () => {
    router.replace(pathname, { locale: isEn ? 'fr' : 'en' });
  };

  // ROI Math
  const monthlyConvs = conversationsPerDay * 30;
  const hoursSavedPerMonth = Math.round((monthlyConvs * minsPerConv) / 60);
  const hourlyRate = operatorMonthlyCost / 160; // 160 hours standard work month
  const monthlySavingsXaf = Math.round(hoursSavedPerMonth * hourlyRate);
  const starterPrice = billingCycle === 'yearly' ? 4500 : 5000;
  const netSavingsXaf = Math.max(0, monthlySavingsXaf - starterPrice);
  const roiPercentage = starterPrice > 0 ? Math.round((netSavingsXaf / starterPrice) * 100) : 0;

  // Efficiency Score /100
  const efficiencyScore = Math.min(
    100,
    Math.round(40 + (conversationsPerDay / 150) * 35 + (hoursSavedPerMonth / 100) * 25)
  );

  const getEfficiencyRating = (score: number) => {
    if (score >= 85) return isEn ? 'Hyper-Automated Leader' : 'Entreprise Hyper-Automatisée';
    if (score >= 65) return isEn ? 'Operational Champion' : 'Champion Opérationnel';
    return isEn ? 'High Growth Potential' : 'Fort Potentiel de Croissance';
  };

  // Personas Data for the Interactive Agent Simulator
  const personaScenarios = {
    commerce: {
      title: isEn ? 'Retail & Boutique' : 'Commerce & Boutique',
      clientMessage: isEn
        ? 'Hello! Do you have the sneakers in size 43, and can you deliver to Bonapriso Douala today?'
        : 'Bonjour ! Avez-vous les sneakers en taille 43 et livrez-vous à Bonapriso Douala aujourd’hui ?',
      isAudio: false,
      botReply: isEn
        ? 'Hello! Yes, size 43 is in stock (28,000 FCFA). Same-day delivery to Bonapriso is 1,500 FCFA. Would you like to confirm your order?'
        : 'Bonjour ! Oui, la taille 43 est disponible (28 000 FCFA). Livraison express Bonapriso sous 2h (1 500 FCFA). Souhaitez-vous valider votre commande ?',
      takeoverReply: isEn
        ? 'Hello, this is Eric from the sales desk. I have reserved the size 43 box for you. We accept OM & MoMo.'
        : 'Bonjour, ici Eric du service commercial. Je viens de vous réserver la paire 43. Nous acceptons Orange Money et MoMo.',
      model: 'BYOK Gemini 2.5 / Groq',
      ragSources: 'Catalogue Produits 2026.pdf',
    },
    agency: {
      title: isEn ? 'Agency & B2B Services' : 'Agence Web & B2B',
      clientMessage: isEn
        ? 'Audio message (0:18): We want to redesign our company showcase website in Douala, what is your pricing?'
        : 'Message vocal (0:18) : « Bonjour, nous souhaitons refaire le site vitrine de notre cabinet à Douala, quels sont vos forfaits ? »',
      isAudio: true,
      audioDuration: '0:18',
      botReply: isEn
        ? 'Hello! Our showcase website pack (Site Vitrine) is 40,000 FCFA (3 to 7 pages, mobile responsive, and basic SEO). We can deliver in 5 business days.'
        : 'Bonjour ! Notre forfait Site Vitrine est à 40 000 FCFA (3 à 7 pages responsive, SEO de base et formulaire WhatsApp). Livraison sous 5 jours ouvrés.',
      takeoverReply: isEn
        ? 'Hello, this is the lead developer. I can schedule a 15-minute scoping call tomorrow at 10am.'
        : 'Bonjour, ici le chef de projet web. Je vous propose un appel rapide de cadrage demain à 10h pour vos spécifications.',
      model: 'Whisper INT8 Local + BYOK',
      ragSources: 'Grille Tarifaire Services.pdf',
    },
    booking: {
      title: isEn ? 'Medical & Clinic' : 'Clinique & Rendez-vous',
      clientMessage: isEn
        ? 'Hello, do you have an open appointment for an ultrasound tomorrow morning?'
        : 'Bonjour, avez-vous une disponibilité pour une échographie demain matin ?',
      isAudio: false,
      botReply: isEn
        ? 'Hello! Dr. Kamga has openings tomorrow at 9:30 AM and 11:15 AM at our Akwa clinic. Which slot suits you best?'
        : 'Bonjour ! Le Dr. Kamga a des créneaux disponibles demain à 9h30 et 11h15 au centre d’Akwa. Quel créneau vous convient le mieux ?',
      takeoverReply: isEn
        ? 'Receptionist took over: Slot 9:30 AM is reserved for you. Please bring your doctor prescription.'
        : 'Prise de relais par l’accueil : Votre créneau de 9h30 est bloqué. Merci d’apporter votre ordonnance.',
      model: 'BYOK OpenRouter / GPT-4o',
      ragSources: 'Planning & Praticiens.txt',
    },
    restaurant: {
      title: isEn ? 'Restaurant & Catering' : 'Restaurant & Traiteur',
      clientMessage: isEn
        ? 'Audio message (0:12): Can I reserve a table for 4 tonight and see today’s specials?'
        : 'Message vocal (0:12) : « Bonsoir, est-il possible de réserver une table de 4 pour ce soir et connaître le menu du jour ? »',
      isAudio: true,
      audioDuration: '0:12',
      botReply: isEn
        ? 'Good evening! Tonight’s special is Grilled Ndolé with Plantains (6,500 FCFA). A table for 4 is reserved for 8:00 PM.'
        : 'Bonsoir ! Notre plat du soir est le Ndolé Crevettes avec plantains mûrs (6 500 FCFA). Votre table de 4 personnes est notée pour 20h00.',
      takeoverReply: isEn
        ? 'Head Chef on line: Table #7 on the terrace is prepared for you!'
        : 'Maître d’hôtel en ligne : La table n°7 en terrasse vous est réservée !',
      model: 'Whisper INT8 Local + BYOK',
      ragSources: 'Menu & Réservations.pdf',
    },
  }[simPersona];

  const templates = [
    {
      icon: UserCheck,
      title: isEn ? 'Front Desk Receptionist' : 'Agent Réceptionniste',
      desc: isEn
        ? 'Greets callers 24/7, explains opening hours, and answers recurring queries accurately.'
        : 'Accueille vos clients 24h/24, présente vos services et répond aux questions fréquentes.',
    },
    {
      icon: Briefcase,
      title: isEn ? 'Sales Advisor' : 'Assistant Commercial',
      desc: isEn
        ? 'Presents pricing in FCFA, qualifies leads, and prepares commercial handoffs.'
        : 'Présente vos tarifs en FCFA, qualifie vos prospects et prépare les commandes.',
    },
    {
      icon: Headphones,
      title: isEn ? 'Customer Support' : 'Support Client',
      desc: isEn
        ? 'Resolves recurring tickets using your PDF, TXT, and public website documentation.'
        : 'Répond aux demandes courantes à partir de vos fiches, documents PDF et liens web.',
    },
    {
      icon: CalendarCheck,
      title: isEn ? 'Appointment Booking' : 'Prise de Rendez-vous',
      desc: isEn
        ? 'Collects availability, confirms slots, and remembers client preferences.'
        : 'Recueille les disponibilités et prépare les rendez-vous avec historique contact.',
    },
    {
      icon: Utensils,
      title: isEn ? 'Restaurant & Delivery' : 'Restaurant & Livraison',
      desc: isEn
        ? 'Shares menus, delivery zones, and hands over orders smoothly.'
        : 'Partage la carte du jour, les zones de livraison et transfère les commandes.',
    },
    {
      icon: Bot,
      title: isEn ? 'Custom Studio Agent' : 'Assistant Sur-Mesure',
      desc: isEn
        ? 'Tailored system prompt, language tone, and your chosen AI provider.'
        : 'Instructions personnalisées avec votre modèle et fournisseur IA de choix.',
    },
  ];

  const faqs = [
    {
      q: isEn
        ? 'How does WhatsApp connection work without a QR code?'
        : 'Comment fonctionne la connexion WhatsApp sans QR Code ?',
      a: isEn
        ? 'Innoica Agent Studio uses Baileys Pairing Code exclusively: you enter your international phone number (e.g. +237...) and enter an 8-character code inside WhatsApp > Linked Devices.'
        : 'Innoica Agent Studio utilise exclusivement le Pairing Code : saisissez votre numéro international (+237...) puis entrez le code à 8 caractères dans WhatsApp > Appareils connectés.',
    },
    {
      q: isEn
        ? 'How does voice message understanding work?'
        : 'Comment fonctionne la compréhension des messages vocaux ?',
      a: isEn
        ? 'On the Starter plan, incoming voice notes are transcribed locally on the server using an embedded multilingual INT8 Whisper engine with zero paid per-minute APIs. The agent extracts verified facts and responds in text in the customer\'s language.'
        : 'Sur le plan Starter, les messages vocaux sont transcrits localement sur le serveur grâce à un moteur Whisper INT8 multilingue, sans aucun service externe facturé à la minute. L\'agent analyse le contenu et répond par écrit dans la langue du client.',
    },
    {
      q: isEn
        ? 'What does BYOK mean?'
        : 'Que signifie BYOK (Bring Your Own Key) ?',
      a: isEn
        ? 'You plug in your own API key (Google Gemini, Groq, OpenRouter, or OpenAI). Keys are encrypted with AES-256-GCM server-side and never exposed to the browser.'
        : 'Vous connectez votre propre clé API (Google Gemini, Groq, OpenRouter ou OpenAI), chiffrée côté serveur en AES-256-GCM. Aucune marge cachée sur vos jetons IA.',
    },
    {
      q: isEn
        ? 'What is the difference between Free and Starter?'
        : 'Quelle est la différence entre les offres Free et Starter ?',
      a: isEn
        ? 'Free (0 FCFA) covers 1 agent, 1 number, 5 new conversations/day, 10 bot replies/conversation/day, 7-day history, text messages only, and includes an INNOICA signature. Starter (5,000 FCFA/month or 54,000 FCFA/year) unlocks 2 agents, 2 numbers, multilingual voice message understanding included with zero extra fee, PDF/URL ingestion, durable memory, no INNOICA daily limits, and zero advertising signature.'
        : 'Free (0 FCFA) inclut 1 agent, 1 numéro, 5 nouvelles conversations/jour, 10 réponses IA/conversation/jour, historique 7 jours, messages texte uniquement et signature INNOICA. Starter (5 000 FCFA/mois ou 54 000 FCFA/an) débloque 2 agents, 2 numéros, la compréhension des messages vocaux FR & EN incluse sans supplément, PDF/URL, mémoire durable, aucun quota quotidien INNOICA et zéro signature publicitaire.',
    },
    {
      q: isEn
        ? 'Is this an official Meta/WhatsApp API?'
        : 'S’agit-il d’une API officielle Meta / WhatsApp ?',
      a: isEn
        ? 'No. WhatsApp connectivity relies on the open-source Baileys engine. Platform terms and anti-spam rules apply strictly.'
        : 'Non. La connexion s’appuie sur le moteur open-source Baileys (non officiel). Le respect des conditions d’utilisation WhatsApp et l’absence de spam sont obligatoires.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafb] text-zinc-900 overflow-x-clip antialiased">
      {/* Topbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md transition-all duration-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <BrandLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600">
            <a href="#problem-solution" className="hover:text-zinc-900 transition-colors">
              {isEn ? 'Solution' : 'Pourquoi Innoica'}
            </a>
            <a href="#simulator" className="hover:text-zinc-900 transition-colors">
              {isEn ? 'Simulator & ROI' : 'Simulateur & Rentabilité'}
            </a>
            <a href="#studio-tour" className="hover:text-zinc-900 transition-colors">
              {isEn ? 'Studio Tour' : 'Démonstration Studio'}
            </a>
            <a href="#templates" className="hover:text-zinc-900 transition-colors">
              {isEn ? 'Use Cases' : 'Modèles'}
            </a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">
              {isEn ? 'Pricing' : 'Tarifs FCFA'}
            </a>
            <a href="#faq" className="hover:text-zinc-900 transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={switchLocale}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors shrink-0"
            >
              <Globe className="h-3 w-3 text-zinc-400 shrink-0" />
              <span>{isEn ? 'FR' : 'EN'}</span>
            </button>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              >
                <span className="hidden sm:inline">{isEn ? 'Open Studio' : 'Accéder au Studio'}</span>
                <span className="sm:hidden">Studio</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer shrink-0"
                >
                  {isEn ? 'Sign In' : 'Connexion'}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                >
                  <span className="hidden sm:inline">{isEn ? 'Start Free' : 'Créer un compte'}</span>
                  <span className="sm:hidden">{isEn ? 'Start' : 'Démarrer'}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </Link>
              </>
            )}

            {/* Mobile Hamburger Drawer Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-zinc-900/30 backdrop-blur-xs md:hidden animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 p-4 shadow-lg md:hidden animate-fade-in-up space-y-3">
            <nav className="flex flex-col space-y-1">
              {[
                { href: '#problem-solution', label: isEn ? 'Why Innoica' : 'Pourquoi Innoica' },
                { href: '#architecture', label: isEn ? 'Architecture' : 'Pipeline Technique' },
                { href: '#simulator', label: isEn ? 'Simulator & ROI' : 'Simulateur & Rentabilité' },
                { href: '#studio-tour', label: isEn ? 'Studio Tour' : 'Démonstration Studio' },
                { href: '#templates', label: isEn ? 'Use Cases' : 'Modèles d’Agents' },
                { href: '#pricing', label: isEn ? 'Pricing' : 'Tarifs FCFA' },
                { href: '#faq', label: 'FAQ' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 transition-colors flex items-center justify-between"
                >
                  <span>{link.label}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                </a>
              ))}
            </nav>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  switchLocale();
                  setMobileMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5 text-zinc-400" />
                <span>{isEn ? 'Passer en FR' : 'Switch to EN'}</span>
              </button>

              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
                >
                  <span>{isEn ? 'Studio' : 'Studio'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    {isEn ? 'Sign In' : 'Connexion'}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
                  >
                    <span>{isEn ? 'Start' : 'Créer'}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hero Section */}
      <section className="relative pt-10 pb-16 sm:pt-14 sm:pb-20 border-b border-zinc-200/80 bg-gradient-to-b from-white via-zinc-50/50 to-[#fafafb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-700 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 animate-beacon" />
              </span>
              <span className="font-mono text-zinc-900 font-semibold">INNOICA STUDIO</span>
              <span className="text-zinc-300">|</span>
              <span>Plateforme SaaS d'Agents WhatsApp IA</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-zinc-900 leading-[1.15] animate-fade-in-up animation-delay-75">
              {isEn
                ? 'Automate customer sales and support on WhatsApp. Supervise in real time.'
                : 'Automatisez vos ventes et votre support client sur WhatsApp. Supervisez en direct.'}
            </h1>

            <p className="text-sm text-zinc-600 leading-relaxed max-w-2xl animate-fade-in-up animation-delay-150">
              {isEn
                ? 'INNOICA is the first WhatsApp Agent Studio engineered with Pairing Code (zero QR code), encrypted Bring-Your-Own-Key (BYOK), local multilingual Whisper voice message comprehension, and instant human takeover from your inbox.'
                : 'INNOICA est le premier studio d’agents WhatsApp autonome configuré par Pairing Code (sans aucun QR Code), avec vos propres clés IA chiffrées (BYOK), la compréhension locale des messages vocaux par Whisper, et la reprise humaine instantanée sans recharger la page.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 animate-fade-in-up animation-delay-225">
              <Link
                href={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-all duration-200 shadow-2xs cursor-pointer hover:shadow-sm hover:-translate-y-0.5"
              >
                <span>{isAuthenticated ? 'Ouvrir mon Studio' : isEn ? 'Start Free (0 FCFA)' : 'Démarrer gratuitement (0 FCFA)'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all duration-200 cursor-pointer hover:shadow-2xs"
              >
                <Sliders className="h-4 w-4 text-zinc-500" />
                <span>{isEn ? 'Test Interactive Simulator' : 'Tester le Simulateur & Rentabilité'}</span>
              </a>
            </div>

            {/* Quick Proof Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-200/80 text-xs animate-fade-in-up animation-delay-300">
              <div className="rounded-lg bg-white p-2.5 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-zinc-700" />
                  Pairing Code
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  {isEn ? 'Zero QR code' : 'Sans aucun QR Code'}
                </div>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-emerald-600" />
                  Message Vocal
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  Whisper FR & EN inclus
                </div>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-zinc-700" />
                  BYOK Sécurisé
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  AES-256-GCM chiffré
                </div>
              </div>

              <div className="rounded-lg bg-white p-2.5 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-600" />
                  Reprise 0ms
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  Human Takeover en 1 clic
                </div>
              </div>
            </div>
          </div>

          {/* Hero Visual Mockup: Official Logo Brand Hexagon & Live Preview Card */}
          <div className="lg:col-span-5 flex flex-col gap-4 animate-fade-in-up animation-delay-150">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-2xs hover-card-lift">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-zinc-800 shadow-xs">
                    <Image
                      src="/images/innoica-logo.jpg"
                      alt="INNOICA"
                      width={40}
                      height={40}
                      priority
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                      <span>INNOICA Studio Engine</span>
                      <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-mono">
                        v2.2
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">Douala • Africa/Douala UTC+1</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Actif 24/7</span>
                </div>
              </div>

              {/* Realistic Mini WhatsApp Thread Simulation */}
              <div className="rounded-lg bg-[#efeae2]/60 border border-zinc-200/70 p-3 space-y-2.5 text-xs font-sans">
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-lg rounded-tl-xs bg-white border border-zinc-200/80 p-2.5 shadow-2xs space-y-1.5">
                    <div className="text-[10px] font-mono text-zinc-400">Contact WhatsApp (+237)</div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Mic className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex items-end gap-[2px] h-5 flex-1">
                        {[6, 12, 18, 10, 14, 20, 8, 16, 22, 14, 8, 12, 18, 16, 10, 14, 8, 6].map((h, i) => (
                          <div
                            key={i}
                            className="w-[3px] bg-emerald-700/80 rounded-full"
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400 tabular-nums">0:14</span>
                    </div>
                    <div className="text-[11px] text-zinc-700 italic border-t border-zinc-100 pt-1">
                      « Bonjour, vos tarifs pour la création de site vitrine ? »
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-lg rounded-tr-xs bg-[#d9fdd3] text-zinc-900 border border-emerald-200/80 px-2.5 py-1.5 shadow-2xs">
                    <div className="text-[10px] font-mono text-emerald-800 font-medium mb-0.5 flex items-center justify-between gap-2">
                      <span>Assistant Innoica</span>
                      <span className="text-[9px] text-emerald-700">Whisper INT8</span>
                    </div>
                    <div className="text-[11px] leading-relaxed">
                      Bonjour ! Notre forfait Site Vitrine est à 40 000 FCFA (3 à 7 pages, mobile responsive, SEO). Nous pouvons commencer dès réception de votre logo.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  BYOK Clé Chiffrée AES-256
                </span>
                <span className="text-zinc-900 font-semibold">5 000 FCFA / mois</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution Narrative */}
      <section id="problem-solution" className="py-16 bg-white border-b border-zinc-200/80 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {isEn ? 'Why Businesses Choose INNOICA' : 'Pourquoi les entreprises choisissent INNOICA'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              {isEn
                ? 'Overcoming the flaws of traditional chatbots and expensive foreign platforms.'
                : 'Résolvez les limites des chatbots traditionnels et des plateformes étrangères inadaptées.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Problem */}
            <div className="rounded-xl border border-red-200/80 bg-red-50/20 p-6 space-y-4 hover-card-lift transition-all duration-200">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 uppercase tracking-wider font-mono">
                <span>Le Problème Traditionnel</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-700">
                <li className="flex items-start gap-2.5">
                  <span className="h-4 w-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✕</span>
                  <span><strong>Perte de ventes la nuit et le week-end :</strong> Vos prospects WhatsApp écrivent à 21h ou le dimanche et vont chez vos concurrents si personne ne répond.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-4 w-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✕</span>
                  <span><strong>Messages vocaux inaudibles en réunion :</strong> Les clients africains envoient majoritairement des vocaux. Taper pour y répondre prend 10 minutes par client.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-4 w-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✕</span>
                  <span><strong>QR codes fastidieux :</strong> Scanner un QR code depuis un deuxième smartphone ou PC bloque l'onboarding de vos équipes sur le terrain.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-4 w-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✕</span>
                  <span><strong>Tarifs en dollars exorbitants :</strong> Des outils américains à $99/mois surfacturent chaque token IA sans accepter Orange Money ou MTN MoMo.</span>
                </li>
              </ul>
            </div>

            {/* The INNOICA Solution */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-6 space-y-4 hover-card-lift transition-all duration-200">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 uppercase tracking-wider font-mono">
                <span>La Solution INNOICA Agent Studio</span>
              </div>
              <ul className="space-y-3 text-xs text-zinc-700">
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Réponses instantanées 24h/24 :</strong> Qualification immédiate de vos prospects, transmission de devis et prise de commande même à 3h du matin.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Whisper INT8 Multilingue :</strong> Transcription locale des vocaux FR & EN sans API externe payante. L’agent écoute et répond avec précision.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Pairing Code 8 caractères :</strong> Entrez simplement votre numéro international (+237...) et connectez WhatsApp en 10 secondes sans aucun QR code.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>BYOK + Facturation FCFA :</strong> Branchez vos clés IA sans surcoût. Forfait Starter à 5 000 FCFA/mois payable en Orange Money, MTN MoMo ou carte.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Sovereign Architecture & Flow Illustration */}
      <section id="architecture" className="py-16 bg-[#f8f9fa] border-b border-zinc-200/80 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 border border-zinc-200 px-3 py-0.5 text-[10px] font-mono font-medium text-zinc-700">
              <Layers className="h-3.5 w-3.5 text-zinc-700" />
              <span>Pipeline Technologique Souverain</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {isEn ? 'How INNOICA Works from Inbound to Outbound' : 'Comment fonctionne le flux WhatsApp de bout en bout'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              {isEn
                ? 'Zero third-party audio costs, strict AES-256 BYOK encryption, and sub-second human intervention.'
                : 'Zéro surcoût vocal, clés chiffrées côté serveur et reprise en main humaine sans temps de latence.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Step 1 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between hover-card-lift transition-all duration-200">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                  <span>01</span>
                  <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-semibold">Entrant</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center mb-2.5">
                  <Smartphone className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-900">Contact WhatsApp</h4>
                <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                  Envoi d'un message texte ou d'une note vocale depuis Douala, Yaoundé ou l'international.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 text-[10px] font-mono text-zinc-500">
                Numéro E.164 (+237)
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between hover-card-lift transition-all duration-200">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                  <span>02</span>
                  <span className="rounded bg-zinc-100 text-zinc-700 border border-zinc-200 px-1.5 py-0.2 text-[9px] font-semibold">Baileys</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center mb-2.5">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-900">Pairing Code</h4>
                <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                  Connexion WebSocket sécurisée via code à 8 caractères. Zéro QR code requis sur PC ou mobile.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 text-[10px] font-mono text-zinc-500">
                100% Baileys Multi-Device
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/20 p-4 shadow-2xs flex flex-col justify-between hover-card-lift transition-all duration-200">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-emerald-800 mb-2">
                  <span>03</span>
                  <span className="rounded bg-emerald-100 text-emerald-900 font-semibold px-1.5 py-0.2 text-[9px]">Whisper INT8</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2.5">
                  <Mic className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-900">Transcription Locale</h4>
                <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                  Speech Worker privé exécutant Faster-Whisper. Transcrit le français et l'anglais sans API payante.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-emerald-200/60 text-[10px] font-mono text-emerald-800 font-semibold">
                0 FCFA / minute
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between hover-card-lift transition-all duration-200">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                  <span>04</span>
                  <span className="rounded bg-zinc-100 text-zinc-700 border border-zinc-200 px-1.5 py-0.2 text-[9px] font-semibold">BYOK</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center mb-2.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-900">RAG & IA Dédiée</h4>
                <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
                  Injection de vos PDF, fiches et mémoire contact. Appel direct de votre modèle (Gemini, Groq, OpenAI).
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 text-[10px] font-mono text-zinc-500">
                Clé AES-256-GCM
              </div>
            </div>

            {/* Step 5 */}
            <div className="rounded-xl border border-zinc-900 bg-zinc-900 text-white p-4 shadow-2xs flex flex-col justify-between hover-card-lift transition-all duration-200">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                  <span>05</span>
                  <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-semibold">Sortant</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-zinc-800 text-white flex items-center justify-center mb-2.5">
                  <Zap className="h-4 w-4 text-emerald-400" />
                </div>
                <h4 className="text-xs font-semibold text-white">Supervision & Réponse</h4>
                <p className="text-[11px] text-zinc-300 mt-1 leading-relaxed">
                  L'Inbox reçoit l'échange en direct. L'opérateur peut couper l'IA en 1 clic ou la laisser répondre.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800 text-[10px] font-mono text-emerald-400 font-semibold">
                Reprise Humaine 0ms
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gamification: Interactive Simulator & ROI Calculator */}
      <section id="simulator" className="py-16 border-b border-zinc-200/80 bg-[#fafafb] scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 border border-zinc-200 px-3 py-0.5 text-[10px] font-mono font-medium text-zinc-700">
              <Sliders className="h-3.5 w-3.5 text-zinc-700" />
              <span>Simulateur d’Agent & Calculateur de Rentabilité</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {isEn ? 'Experience your agent live & calculate your savings' : 'Testez un agent en direct et calculez vos économies en FCFA'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              {isEn
                ? 'Simulate customer inquiries, trigger human takeover, and measure your monthly return on investment.'
                : 'Sélectionnez un secteur d’activité, testez les réponses textuelles et vocales, et estimez vos gains opérationnels.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Interactive Chat Simulation Playground */}
            <div className="lg:col-span-6 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900">1. Choisissez un profil métier</h3>
                  <p className="text-[11px] text-zinc-500">Adaptez les requêtes au cas d'usage de votre entreprise</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Live Demo
                  </span>
                </div>
              </div>

              {/* Persona Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['commerce', 'agency', 'booking', 'restaurant'] as const).map((key) => {
                  const active = simPersona === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSimPersona(key);
                        setSimMode('ai');
                        if (key === 'agency' || key === 'restaurant') {
                          setUnlockedBadges((b) => ({ ...b, testedVocal: true }));
                        }
                      }}
                      className={`rounded-lg px-2.5 py-2 text-center text-xs font-medium cursor-pointer transition-colors border ${
                        active
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <div className="truncate font-semibold">
                        {key === 'commerce'
                          ? 'Commerce'
                          : key === 'agency'
                          ? 'Agence Web'
                          : key === 'booking'
                          ? 'Clinique'
                          : 'Restaurant'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Simulated Chat Viewport */}
              <div className="rounded-xl bg-[#efeae2]/50 border border-zinc-200 p-4 space-y-3 font-sans">
                {/* Incoming Client Query */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl rounded-tl-xs bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-800 shadow-2xs">
                    <div className="text-[10px] font-mono font-medium text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Client WhatsApp (+237)</span>
                      <span className="text-[9px]">14:32</span>
                    </div>

                    {personaScenarios.isAudio ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 rounded-lg bg-zinc-50 border border-zinc-200 p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSimAudioPlaying(!simAudioPlaying);
                              setUnlockedBadges((b) => ({ ...b, testedVocal: true }));
                            }}
                            className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-emerald-700 transition-colors shadow-2xs"
                            title={simAudioPlaying ? 'Mettre en pause' : 'Écouter le message vocal'}
                          >
                            <Play className={`h-3.5 w-3.5 fill-current ml-0.5 ${simAudioPlaying ? 'opacity-80' : ''}`} />
                          </button>
                          <div className="flex items-end gap-[3px] h-6 flex-1 py-0.5">
                            {[4, 10, 16, 8, 14, 22, 12, 18, 24, 16, 10, 14, 20, 18, 12, 16, 8, 14, 20, 12, 6, 4].map((h, i) => (
                              <div
                                key={i}
                                className={`w-1 rounded-full transition-all duration-200 ${
                                  simAudioPlaying
                                    ? 'bg-emerald-600 animate-wave-bar'
                                    : 'bg-zinc-300'
                                }`}
                                style={{
                                  height: `${h}px`,
                                  animationDelay: `${(i % 5) * 120}ms`,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-mono text-zinc-600 tabular-nums">
                            {personaScenarios.audioDuration}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-700 italic leading-relaxed">
                          {personaScenarios.clientMessage}
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-800 leading-relaxed">
                        {personaScenarios.clientMessage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Outgoing Bot or Human Takeover Response */}
                <div className="flex justify-end">
                  <div
                    className={`max-w-[88%] rounded-xl rounded-tr-xs px-3 py-2 text-xs shadow-2xs transition-all ${
                      simMode === 'takeover'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-[#d9fdd3] text-zinc-900 border border-emerald-200/80'
                    }`}
                  >
                    <div
                      className={`text-[10px] font-mono font-semibold mb-1 flex items-center justify-between gap-3 ${
                        simMode === 'takeover' ? 'text-zinc-400' : 'text-emerald-800'
                      }`}
                    >
                      <span>
                        {simMode === 'takeover' ? 'Opérateur Humain (Studio)' : 'Assistant Innoica IA'}
                      </span>
                      <span className="text-[9px] tabular-nums">
                        {simMode === 'takeover' ? 'Reprise directe' : 'Moteur RAG + BYOK'}
                      </span>
                    </div>

                    <div className="leading-relaxed">
                      {simMode === 'takeover'
                        ? personaScenarios.takeoverReply
                        : personaScenarios.botReply}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode Control: Switch to Human Takeover */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100">
                <div className="text-[11px] text-zinc-500 font-mono">
                  Source: <span className="font-semibold text-zinc-700">{personaScenarios.ragSources}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimMode('ai');
                    }}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                      simMode === 'ai'
                        ? 'bg-emerald-100 text-emerald-800 font-semibold'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    IA Active
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimMode('takeover');
                      setUnlockedBadges((b) => ({ ...b, testedTakeover: true }));
                    }}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                      simMode === 'takeover'
                        ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                        : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    ⚡ Tester Reprise Humaine
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Financial & Operational ROI Calculator */}
            <div className="lg:col-span-6 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
              <div className="border-b border-zinc-100 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-900">
                    2. Calculez votre Rentabilité Opérationnelle
                  </h3>
                  <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-medium">
                    Calcul en FCFA
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Ajustez les curseurs selon le volume d'échanges WhatsApp de votre entreprise
                </p>
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-700 mb-1.5">
                    <span>Conversations WhatsApp reçues par jour :</span>
                    <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                      {conversationsPerDay} conv / jour
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={conversationsPerDay}
                    onChange={(e) => setConversationsPerDay(Number(e.target.value))}
                    className="w-full accent-zinc-900 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-0.5">
                    <span>5 (Boutique locale)</span>
                    <span>100 (Service actif)</span>
                    <span>200+ (Grande enseigne)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-700 mb-1.5">
                    <span>Temps moyen passé manuellement par message :</span>
                    <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                      {minsPerConv} minutes / message
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={minsPerConv}
                    onChange={(e) => setMinsPerConv(Number(e.target.value))}
                    className="w-full accent-zinc-900 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-0.5">
                    <span>1 min (Questions brèves)</span>
                    <span>5 min (Vocaux & Devis)</span>
                    <span>10 min (Négociations)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-700 mb-1.5">
                    <span>Salaire mensuel estimé d'un opérateur support :</span>
                    <span className="font-mono tabular-nums text-zinc-900 font-semibold">
                      {operatorMonthlyCost.toLocaleString('fr-FR')} FCFA / mois
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50000}
                    max={300000}
                    step={10000}
                    value={operatorMonthlyCost}
                    onChange={(e) => setOperatorMonthlyCost(Number(e.target.value))}
                    className="w-full accent-zinc-900 cursor-pointer"
                  />
                </div>
              </div>

              {/* Calculated Outputs Cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3">
                  <div className="text-[11px] font-medium text-zinc-500">Heures de travail économisées</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-zinc-900">
                    {hoursSavedPerMonth} h
                    <span className="text-xs text-zinc-400 font-normal ml-1">/ mois</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    soit {(hoursSavedPerMonth / 8).toFixed(1)} journées de travail gagnées
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50/50 border border-emerald-200 p-3">
                  <div className="text-[11px] font-medium text-emerald-800">Économie financière nette</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                    {monthlySavingsXaf.toLocaleString('fr-FR')} FCFA
                  </div>
                  <div className="text-[10px] text-emerald-800/80 mt-0.5 font-mono">
                    pour 5 000 FCFA/mois de Starter
                  </div>
                </div>
              </div>

              {/* Gamified Efficiency Score & Achievement Badges */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-semibold text-zinc-800">
                      Score d'Efficacité Opérationnelle
                    </span>
                  </div>
                  <span className="text-sm font-bold font-mono text-zinc-900 tabular-nums">
                    {efficiencyScore}/100
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                    style={{ width: `${efficiencyScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-600">
                  <span>Rang : <strong>{getEfficiencyRating(efficiencyScore)}</strong></span>
                  <span className="font-mono text-emerald-700 font-semibold tabular-nums">ROI : +{roiPercentage}%</span>
                </div>

                {/* Micro Badges earned during interactive test */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-200/60">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono ${
                      unlockedBadges.testedVocal
                        ? 'bg-emerald-100 text-emerald-800 font-semibold'
                        : 'bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {unlockedBadges.testedVocal ? '✓ Vocal Whisper Écouté' : '○ Débloquer Vocal'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono ${
                      unlockedBadges.testedTakeover
                        ? 'bg-emerald-100 text-emerald-800 font-semibold'
                        : 'bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {unlockedBadges.testedTakeover ? '✓ Reprise 0ms Testée' : '○ Débloquer Reprise'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 text-[10px] font-mono">
                    ✓ Pairing Code Prêt
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Studio Tour: High-Fidelity UI Snapshots & Realistic Tabs */}
      <section id="studio-tour" className="py-16 bg-white border-b border-zinc-200/80 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {isEn ? 'Inside INNOICA Agent Studio' : 'Aperçu Réel du Studio INNOICA'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              {isEn
                ? 'An authentic production interface built for speed, calm supervision, and reliability.'
                : 'Une interface pensée pour la productivité opérationnelle, la clarté et la supervision en direct.'}
            </p>
          </div>

          {/* Interactive Showcase Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex flex-wrap sm:flex-nowrap justify-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 max-w-full">
              <button
                type="button"
                onClick={() => setActiveStudioTab('inbox')}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  activeStudioTab === 'inbox'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Inbox & Reprise Humaine</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('pairing')}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  activeStudioTab === 'pairing'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Pairing Code Baileys</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('knowledge')}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  activeStudioTab === 'knowledge'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Connaissances & Mémoire RAG</span>
              </button>
            </div>
          </div>

          {/* Realistic High-Fidelity UI Mockup Viewports */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
            {activeStudioTab === 'inbox' && (
              <div className="space-y-0">
                {/* Browser / Studio Window Chrome */}
                <div className="bg-zinc-100/90 border-b border-zinc-200/80 px-4 py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] inline-block" />
                    <span className="ml-2 text-[11px] font-mono text-zinc-500 hidden sm:inline">
                      innoica.studio — Inbox / Workspace Douala HQ
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                    </span>
                    <span className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Supabase Realtime • Connecté (Africa/Douala)
                    </span>
                  </div>
                </div>

                {/* 3-Column Studio Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px] bg-white divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
                  {/* Left Column: Conversation Sidebar */}
                  <div className="lg:col-span-3 p-3 space-y-2 bg-zinc-50/40">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                      <input
                        type="text"
                        readOnly
                        value="Rechercher un contact..."
                        className="w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 py-1.5 text-[11px] text-zinc-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-600 pb-1">
                      <span className="rounded bg-zinc-900 text-white px-2 py-0.5">Tous (2)</span>
                      <span className="rounded bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5">IA Active</span>
                      <span className="rounded bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5">Reprise (1)</span>
                    </div>

                    {/* Active Conversation Card */}
                    <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-900 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                        <span className="truncate">Alain M. (+237 691 23 45 67)</span>
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">14:28</span>
                      </div>
                      <div className="text-[11px] text-zinc-600 truncate">
                        Devis Site Vitrine & Délais
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[9px] font-mono font-medium">
                          Reprise Humaine
                        </span>
                        <span className="rounded-full bg-emerald-600 text-white px-1.5 py-0.2 text-[9px] font-mono font-bold">
                          1
                        </span>
                      </div>
                    </div>

                    {/* Secondary Conversation Card */}
                    <div className="p-2.5 rounded-lg bg-white border border-zinc-200 text-xs space-y-1 opacity-75">
                      <div className="flex items-center justify-between font-medium text-zinc-700">
                        <span className="truncate">Blandine K. (+237 670 99 88 77)</span>
                        <span className="text-[10px] font-mono text-zinc-400">13:50</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        Horaires agence Akwa
                      </div>
                      <span className="inline-block rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-mono">
                        IA Active
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: Chat Messages & Composer */}
                  <div className="lg:col-span-6 p-4 flex flex-col justify-between bg-[#efeae2]/30">
                    <div className="space-y-3 overflow-y-auto pr-1">
                      {/* Mode Banner */}
                      <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-[11px]">
                        <span className="text-zinc-600 font-medium">Statut du fil :</span>
                        <span className="rounded-md bg-zinc-900 text-white px-2 py-0.5 text-[10px] font-mono font-semibold flex items-center gap-1">
                          <Zap className="h-3 w-3 text-emerald-400" />
                          Reprise Humaine Active (0ms)
                        </span>
                      </div>

                      {/* Inbound Voice Note from WhatsApp Contact */}
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-xl rounded-tl-xs bg-white border border-zinc-200/90 p-3 shadow-2xs space-y-1.5">
                          <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between">
                            <span>Alain M. (+237 691 23 45 67)</span>
                            <span>14:26</span>
                          </div>
                          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200/80 rounded-md p-1.5">
                            <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <Mic className="h-3 w-3" />
                            </div>
                            <div className="flex items-end gap-[2px] h-4 flex-1">
                              {[6, 12, 18, 10, 14, 20, 8, 16, 22, 14, 8, 12, 18, 16, 10, 14].map((h, i) => (
                                <div key={i} className="w-[2px] bg-emerald-600/70 rounded-full" style={{ height: `${h}px` }} />
                              ))}
                            </div>
                            <span className="text-[9px] font-mono text-zinc-500">0:14</span>
                          </div>
                          <div className="text-[11px] text-zinc-700 italic">
                            « Bonjour, vos tarifs pour la création de site vitrine ? »
                          </div>
                          <div className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                            Whisper INT8 Local • 100% Hors Ligne
                          </div>
                        </div>
                      </div>

                      {/* AI Outbound Answer */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-xl rounded-tr-xs bg-[#d9fdd3] text-zinc-900 border border-emerald-200/80 p-3 shadow-2xs space-y-1">
                          <div className="text-[10px] font-mono text-emerald-800 font-semibold flex items-center justify-between gap-2">
                            <span>Assistant Innoica IA</span>
                            <span className="text-[9px]">14:26</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Bonjour Alain ! Notre pack Site Vitrine est à 40 000 FCFA (3 à 7 pages, mobile responsive, SEO). Souhaitez-vous recevoir la liste des éléments à fournir ?
                          </p>
                        </div>
                      </div>

                      {/* Contact Follow-up */}
                      <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-xl rounded-tl-xs bg-white border border-zinc-200/90 p-2.5 shadow-2xs text-xs text-zinc-800">
                          <div className="text-[10px] font-mono text-zinc-400 mb-0.5">Alain M.</div>
                          D'accord, je valide pour 40 000 FCFA. Quel est votre compte Orange Money marchand ?
                        </div>
                      </div>

                      {/* Human Operator Direct Outbound Takeover */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-xl rounded-tr-xs bg-zinc-900 text-white p-3 shadow-2xs space-y-1">
                          <div className="text-[10px] font-mono text-zinc-400 font-semibold flex items-center justify-between gap-2">
                            <span>Opérateur Studio (Vous)</span>
                            <span className="text-emerald-400 text-[9px]">Reprise directe</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Bonjour Alain, voici notre compte OM marchand : 695 12 34 56 (INNOICA SARL). Nous activons votre maquette dès notification !
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Composer */}
                    <div className="mt-3 pt-3 border-t border-zinc-200 bg-white -mx-4 -mb-4 p-3 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value="Répondre directement au client en tant qu'humain (Entrée pour envoyer)..."
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-500 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 transition-colors cursor-pointer text-xs font-medium flex items-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Envoyer</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Contact Memories & RAG Inspector */}
                  <div className="lg:col-span-3 p-3.5 space-y-3 bg-zinc-50/40 text-xs">
                    <div>
                      <h4 className="font-semibold text-zinc-900 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-zinc-500" />
                        Fiche Contact
                      </h4>
                      <div className="mt-1 text-[11px] font-mono text-zinc-600">
                        +237 691 23 45 67 • Alain M.
                      </div>
                      <div className="text-[10px] text-zinc-400">Créé le 16/11/2026 à Douala</div>
                    </div>

                    <div className="pt-2 border-t border-zinc-200 space-y-1.5">
                      <h4 className="font-semibold text-zinc-900 flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-emerald-600" />
                        Mémoires Contact Extraites
                      </h4>
                      <div className="space-y-1">
                        <div className="rounded bg-white p-1.5 border border-zinc-200/80">
                          <span className="font-mono text-[10px] text-zinc-400">budget</span>
                          <div className="font-mono font-medium text-zinc-800 text-[11px]">40 000 FCFA</div>
                        </div>
                        <div className="rounded bg-white p-1.5 border border-zinc-200/80">
                          <span className="font-mono text-[10px] text-zinc-400">projet</span>
                          <div className="font-mono font-medium text-zinc-800 text-[11px]">Site Vitrine 5 pages</div>
                        </div>
                        <div className="rounded bg-white p-1.5 border border-zinc-200/80">
                          <span className="font-mono text-[10px] text-zinc-400">paiement</span>
                          <div className="font-mono font-medium text-zinc-800 text-[11px]">Orange Money</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-200">
                      <h4 className="font-semibold text-zinc-900 mb-1">Notes Internes Studio</h4>
                      <div className="rounded bg-white p-2 border border-zinc-200/80 text-[11px] text-zinc-600 leading-relaxed font-sans">
                        Client très réactif. A validé le devis. Attente notification OM.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStudioTab === 'pairing' && (
              <div className="space-y-0">
                {/* Browser / Studio Window Chrome */}
                <div className="bg-zinc-100/90 border-b border-zinc-200/80 px-4 py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] inline-block" />
                    <span className="ml-2 text-[11px] font-mono text-zinc-500 hidden sm:inline">
                      innoica.studio — Connexion WhatsApp / Baileys Pairing Code
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Zéro QR Code • Protocole Officiel
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] divide-y md:divide-y-0 md:divide-x divide-zinc-200">
                  {/* Left: Studio Web Dialog */}
                  <div className="md:col-span-7 p-6 space-y-5 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-700 mb-2">
                        <span>Étape 1 sur 2</span>
                      </div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        Jumelage de votre numéro WhatsApp
                      </h3>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                        Entrez votre numéro international, puis saisissez le code à 8 caractères directement dans l'application WhatsApp de votre smartphone.
                      </p>

                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                            Numéro WhatsApp de l'agent
                          </label>
                          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-900">
                            <span className="text-zinc-500 mr-2">CM</span>
                            <span className="font-semibold">+237 691 23 45 67</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-medium text-zinc-700">Code de jumelage généré :</span>
                            <span className="font-mono text-emerald-700 font-semibold">Expire dans 02:45</span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-zinc-900 p-4 text-white">
                            <span className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-emerald-400 tabular-nums">
                              INNO-8492
                            </span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs text-zinc-200 transition-colors font-mono cursor-pointer"
                            >
                              Copier
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/80 p-3 flex items-center gap-2.5 text-xs text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        Aucun besoin d'un second smartphone ou d'un écran pour flasher un QR code. Tout est géré par le code.
                      </span>
                    </div>
                  </div>

                  {/* Right: Realistic Smartphone Screen Mockup */}
                  <div className="md:col-span-5 p-6 bg-zinc-50/50 flex items-center justify-center">
                    <div className="w-full max-w-[270px] rounded-[32px] border-4 border-zinc-900 bg-white shadow-lg overflow-hidden flex flex-col">
                      {/* Phone Speaker Notch */}
                      <div className="bg-zinc-900 pt-2 pb-1 flex justify-center">
                        <div className="h-1 w-12 rounded-full bg-zinc-700" />
                      </div>

                      {/* WhatsApp Green Topbar */}
                      <div className="bg-[#00a884] text-white p-3 space-y-0.5">
                        <div className="flex items-center justify-between text-[9px] font-mono opacity-80">
                          <span>14:30</span>
                          <span>WhatsApp • 100%</span>
                        </div>
                        <div className="text-xs font-semibold">Lier avec un numéro</div>
                      </div>

                      {/* Phone WhatsApp Body */}
                      <div className="p-4 space-y-3.5 text-center flex-1">
                        <p className="text-[11px] text-zinc-600 leading-tight">
                          Entrez le code affiché sur l'écran d'INNOICA Studio
                        </p>

                        {/* 8 Character Input Boxes Mockup */}
                        <div className="grid grid-cols-4 gap-1.5 max-w-[190px] mx-auto">
                          {['I', 'N', 'N', 'O', '8', '4', '9', '2'].map((char, i) => (
                            <div
                              key={i}
                              className="h-9 rounded-md border-2 border-emerald-600 bg-emerald-50 flex items-center justify-center font-mono font-bold text-sm text-zinc-900 shadow-2xs"
                            >
                              {char}
                            </div>
                          ))}
                        </div>

                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-2 text-[10px] text-zinc-600 font-mono">
                          Appareil associé : <br />
                          <strong className="text-zinc-900">INNOICA Studio Engine (v2.2)</strong>
                        </div>

                        <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Session jumelée avec succès</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStudioTab === 'knowledge' && (
              <div className="space-y-0">
                {/* Browser / Studio Window Chrome */}
                <div className="bg-zinc-100/90 border-b border-zinc-200/80 px-4 py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] inline-block" />
                    <span className="ml-2 text-[11px] font-mono text-zinc-500 hidden sm:inline">
                      innoica.studio — Base de Connaissances & RAG Vectoriel
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                    3 sources actives • Rétention Illimitée
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="rounded bg-zinc-900 text-white px-2.5 py-1 font-medium text-[11px]">
                        Toutes les sources (3)
                      </span>
                      <span className="rounded bg-zinc-100 text-zinc-700 px-2.5 py-1 text-[11px]">
                        PDF (1)
                      </span>
                      <span className="rounded bg-zinc-100 text-zinc-700 px-2.5 py-1 text-[11px]">
                        Sites Web (1)
                      </span>
                      <span className="rounded bg-zinc-100 text-zinc-700 px-2.5 py-1 text-[11px]">
                        Mémoires (1)
                      </span>
                    </div>

                    <button
                      type="button"
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800 text-xs font-medium flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Ajouter un document</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Card 1: PDF */}
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-8 w-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-mono font-medium">
                          100% Vectorisé
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-900">Catalogue-Tarifs-2026.pdf</h4>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          14 chunks • 4 820 tokens extraits
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-tight">
                        Fiche complète des tarifs en FCFA, zones de livraison Douala et délais.
                      </p>
                    </div>

                    {/* Card 2: URL */}
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <Link2 className="h-4 w-4" />
                        </div>
                        <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-mono font-medium">
                          SSRF Sécurisé
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-900">https://innoica.com/services</h4>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          8 chunks • HTTP 200 OK
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-tight">
                        Crawl automatique sans fuite réseau avec blocage des IP locales/privées.
                      </p>
                    </div>

                    {/* Card 3: Memory */}
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-8 w-8 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center">
                          <Database className="h-4 w-4" />
                        </div>
                        <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-mono font-medium">
                          Rétention Illimitée
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-900">Mémoire Durable Contacts</h4>
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                          18 faits mémorisés
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-tight">
                        Mémorise les budgets, prénoms et commandes passées pour chaque interlocuteur.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-16 bg-[#fafafb] border-b border-zinc-200/80 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {isEn ? 'Preconfigured Agent Templates' : '6 Modèles d’Agents Prêts à l’Emploi'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              {isEn
                ? 'Select a template suited for your activity, connect your knowledge base, and associate WhatsApp.'
                : 'Choisissez un modèle adapté à votre métier, renseignez vos informations et associez votre numéro.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition-all duration-200 shadow-2xs hover-card-lift"
                >
                  <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 bg-white border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-2">
              <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">
                Étape 1
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {isEn ? 'Configure Agent & BYOK' : 'Configurez votre Agent & Clé IA'}
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {isEn
                  ? 'Connect your Gemini, Groq, OpenRouter, or OpenAI API key encrypted with AES-256-GCM server-side.'
                  : 'Renseignez vos instructions et connectez votre clé Gemini, Groq ou OpenAI chiffrée en AES-256 côté serveur.'}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-2">
              <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">
                Étape 2
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {isEn ? 'Link via Pairing Code' : 'Liez WhatsApp sans aucun QR Code'}
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {isEn
                  ? 'Generate an 8-character pairing code and link directly from your WhatsApp phone settings.'
                  : 'Recevez un code à 8 caractères à saisir dans vos appareils connectés WhatsApp sur votre téléphone.'}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-2">
              <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide font-mono">
                Étape 3
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {isEn ? 'Supervise & Take Over Live' : 'Supervisez et reprenez la main'}
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {isEn
                  ? 'Follow every conversation live and pause the AI with one click whenever human intervention is needed.'
                  : 'Suivez les messages entrants en temps réel et mettez l’IA en pause en 1 clic pour répondre vous-même.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  {isEn ? 'Tenant Isolation & Row Level Security' : 'Sécurité serveur & isolation stricte'}
                </h3>
                <p className="text-xs text-zinc-600 mt-0.5 max-w-2xl">
                  {isEn
                    ? 'PostgreSQL Row Level Security (RLS) on all tables, SSRF validation for web crawling, and strict daily Africa/Douala transactional quota tracking.'
                    : 'Isolation RLS sur toutes les tables PostgreSQL, protection anti-SSRF sur l’ingestion de sites web, et quotas transactionnels gérés côté serveur.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 shrink-0">
              <Lock className="h-3.5 w-3.5 text-zinc-500" />
              <span>AES-256-GCM + Postgres RLS</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing: 2 Plans Only (Free + Starter) */}
      <section id="pricing" className="py-16 bg-[#fafafb] border-b border-zinc-200/80 scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {isEn ? 'Two Clear Offers: Free & Starter' : 'Deux Offres Claires : Free et Starter'}
            </h2>
            <p className="text-xs text-zinc-500">
              {isEn
                ? 'Tarification in Central African Francs (FCFA / XAF).'
                : 'Tarifs en Francs CFA (XAF) pour le Cameroun et l’Afrique centrale.'}
            </p>

            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 mt-2">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  billingCycle === 'monthly' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-600'
                }`}
              >
                {isEn ? 'Monthly' : 'Mensuel'}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors ${
                  billingCycle === 'yearly' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-600'
                }`}
              >
                <span>{isEn ? 'Annual' : 'Annuel'}</span>
                <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-semibold">
                  -10%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Free */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col justify-between shadow-2xs hover-card-lift transition-all duration-200">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                  Free
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                    0 FCFA
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {isEn
                    ? 'Discover Innoica Agent Studio with daily limits.'
                    : 'Pour découvrir Innoica Agent Studio gratuitement.'}
                </p>

                <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-700">
                  {[
                    isEn ? '1 WhatsApp AI agent' : '1 agent IA WhatsApp',
                    isEn ? '1 connected WhatsApp number' : '1 numéro WhatsApp connecté',
                    isEn ? '5 new conversations / day' : '5 nouvelles conversations / jour',
                    isEn ? '10 bot replies / conversation / day' : '10 réponses du bot / conversation / jour',
                    isEn ? 'BYOK (Gemini, Groq, OpenRouter, OpenAI)' : 'BYOK (Gemini, Groq, OpenRouter, OpenAI)',
                    isEn ? 'Knowledge: FAQ & TXT (up to 3 sources)' : 'Connaissances : FAQ & TXT (3 sources)',
                    isEn ? '7-day conversation history' : 'Historique limité à 7 jours',
                    isEn ? 'Text messages only (voice notes on Starter)' : 'Messages texte uniquement',
                    isEn ? 'INNOICA signature on bot replies' : 'Signature publicitaire INNOICA incluse',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={isAuthenticated ? '/dashboard' : '/register'}
                className="mt-6 block w-full rounded-lg border border-zinc-300 bg-white py-2.5 text-center text-xs font-medium text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                {isEn ? 'Get Started Free' : 'Créer un compte Free'}
              </Link>
            </div>

            {/* Starter */}
            <div className="rounded-xl border-2 border-zinc-900 bg-white p-6 shadow-xs flex flex-col justify-between hover-card-lift transition-all duration-200">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-900 font-mono">
                    <Zap className="h-3.5 w-3.5 text-emerald-600" /> Starter
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 font-mono">
                    {isEn ? 'Recommended' : 'Recommandé'}
                  </span>
                </div>

                <div className="mt-2">
                  {billingCycle === 'monthly' ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                        5 000 FCFA
                      </span>
                      <span className="text-xs text-zinc-500">/ {isEn ? 'month' : 'mois'}</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                          54 000 FCFA
                        </span>
                        <span className="text-xs text-zinc-500">/ {isEn ? 'year' : 'an'}</span>
                      </div>
                      <div className="text-[11px] text-emerald-600 font-medium mt-0.5 font-mono">
                        Économisez 6 000 FCFA par rapport au tarif mensuel (-10%)
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {isEn
                    ? 'For active businesses and customer service.'
                    : 'Pour les entreprises actives et les services clients.'}
                </p>

                <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-800">
                  {[
                    isEn ? 'Up to 2 WhatsApp AI agents' : 'Jusqu’à 2 agents IA WhatsApp',
                    isEn ? 'Up to 2 connected WhatsApp numbers' : 'Jusqu’à 2 numéros WhatsApp connectés',
                    isEn ? 'Multilingual FR & EN voice notes included (0 extra fee)' : 'Messages vocaux FR & EN compris (zéro surcoût)',
                    isEn ? 'PDF, TXT, FAQ, and public website ingestion' : 'Ingestion PDF, TXT, FAQ et sites web',
                    isEn ? 'Durable contact and conversation memory' : 'Mémoire durable du contact et conversation',
                    isEn ? 'Unlimited conversations & replies (zero INNOICA quotas)' : 'Zéro quota quotidien de conversations INNOICA',
                    isEn ? 'Full history retention (no 7-day limit)' : 'Historique complet sans limitation de durée',
                    isEn ? 'Zero INNOICA advertising signature' : 'Zéro signature publicitaire INNOICA',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={isAuthenticated ? '/subscription' : '/register'}
                className="mt-6 block w-full rounded-lg bg-zinc-900 py-2.5 text-center text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs"
              >
                {isEn ? 'Upgrade to Starter' : 'Activer l’offre Starter'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 bg-white scroll-mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              Questions Fréquentes
            </h2>
            <p className="text-xs text-zinc-500">
              Tout ce qu’il faut savoir sur le fonctionnement d’Innoica Agent Studio.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 border-y border-zinc-200">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left text-xs font-semibold text-zinc-900 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-400 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <p className="mt-2 text-xs text-zinc-600 leading-relaxed pr-6">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <BrandLogo compact />
              <span>© {new Date().getFullYear()} INNOICA Technologies. Tous droits réservés.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-zinc-600 font-medium">
              <Link href={`/${locale}/privacy`} className="hover:text-zinc-950 transition-colors">
                {isEn ? 'Privacy Policy' : 'Politique de Confidentialité'}
              </Link>
              <span>•</span>
              <Link href={`/${locale}/terms`} className="hover:text-zinc-950 transition-colors">
                {isEn ? 'Terms of Service' : 'Conditions Générales (CGU / CGV)'}
              </Link>
              <span>•</span>
              <Link href={`/${locale}/legal`} className="hover:text-zinc-950 transition-colors">
                {isEn ? 'Legal Notice' : 'Mentions Légales'}
              </Link>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
              <span>Douala, Cameroun</span>
              <span>•</span>
              <span>AES-256 BYOK</span>
              <span>•</span>
              <span>Faster-Whisper INT8</span>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 text-center">
            <p className="text-[11px] text-zinc-400 max-w-4xl mx-auto leading-relaxed">
              {isEn
                ? 'Legal Disclaimer: INNOICA is an independent third-party software platform using open-source protocols. WhatsApp and related marks are registered trademarks of Meta Platforms, Inc. INNOICA is not affiliated, sponsored, or endorsed by Meta Platforms, Inc. or WhatsApp LLC.'
                : 'Avis Légal & Non-Affiliation : INNOICA est une plateforme logicielle tierce indépendante exploitant des protocoles open-source. WhatsApp et les marques associées sont des marques déposées de Meta Platforms, Inc. INNOICA n’est ni affilié, ni sponsorisé, ni approuvé par Meta Platforms, Inc. ou WhatsApp LLC.'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
