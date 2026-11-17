'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { BrandLogo } from '@/components/brand-logo';
import { isStoreModuleEnabled } from '@/lib/feature-flags';
import {
  ArrowRight,
  Bot,
  Briefcase,
  Check,
  ChevronDown,
  Globe,
  KeyRound,
  Lock,
  MessageSquare,
  Mic,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Smartphone,
  Sparkles,
  User,
  Zap,
  Layers,
  Menu,
  X,
  Building2,
  FileText,
  Link2,
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

  // Simulator State
  const [simPersona, setSimPersona] = useState<'commerce' | 'agency' | 'booking' | 'restaurant'>('commerce');
  const [simMode, setSimMode] = useState<'ai' | 'takeover'>('ai');
  const [simAudioPlaying, setSimAudioPlaying] = useState(false);
  const [conversationsPerDay, setConversationsPerDay] = useState(45);
  const [minsPerConv, setMinsPerConv] = useState(4);
  const [operatorMonthlyCost, setOperatorMonthlyCost] = useState(120000);

  // Invariant verification tracking
  const [unlockedBadges, setUnlockedBadges] = useState<{
    testedVocal: boolean;
    testedTakeover: boolean;
  }>({
    testedVocal: false,
    testedTakeover: false,
  });

  const switchLocale = () => {
    router.replace(pathname, { locale: isEn ? 'fr' : 'en' });
  };

  // ROI Math
  const monthlyConvs = conversationsPerDay * 30;
  const hoursSavedPerMonth = Math.round((monthlyConvs * minsPerConv) / 60);
  const hourlyRate = operatorMonthlyCost / 160;
  const monthlySavingsXaf = Math.round(hoursSavedPerMonth * hourlyRate);
  const agentPrice = billingCycle === 'yearly' ? 3150 : 3500;
  const netSavingsXaf = Math.max(0, monthlySavingsXaf - agentPrice);

  const efficiencyScore = Math.min(
    100,
    Math.round(45 + (conversationsPerDay / 150) * 30 + (hoursSavedPerMonth / 100) * 25)
  );

  const personaScenarios = {
    commerce: {
      title: isEn ? 'Retail & Boutique' : 'Commerce & Boutique',
      clientMessage: isEn
        ? 'Hello, do you have the white polo in size L and what is the delivery time to Douala?'
        : 'Bonjour, avez-vous le polo blanc en taille L et quel est le délai de livraison à Douala ?',
      isAudio: false,
      botReply: isEn
        ? 'Hello! Yes, size L is available at 12,000 FCFA. Express delivery to Douala takes 2 to 4 hours. You can order directly or reply here.'
        : 'Bonjour ! Oui, la taille L est en stock à 12 000 FCFA. Livraison express Douala sous 2h à 4h (1 500 FCFA). Souhaitez-vous valider votre commande ?',
      takeoverReply: isEn
        ? 'Hello, sales team here. I just set aside the size L polo for you. We accept OM & MoMo.'
        : 'Bonjour, ici le service client. Je viens de réserver le polo taille L à votre nom. Le paiement se fait par Orange Money ou MTN MoMo.',
      model: 'BYOK Gemini / Groq',
      ragSources: 'Catalogue Produits 2026.pdf',
    },
    agency: {
      title: isEn ? 'Agency & B2B Services' : 'Agence Web & B2B',
      clientMessage: isEn
        ? 'Audio message (0:15): "Hello, we need a quote for an institutional website, what are your rates?"'
        : 'Message vocal (0:15) : « Bonjour, nous souhaitons un devis pour un site vitrine professionnel, quels sont vos forfaits ? »',
      isAudio: true,
      audioDuration: '0:15',
      botReply: isEn
        ? 'Hello! Our showcase website pack starts at 40,000 FCFA (3 to 7 responsive pages, mobile first, SEO and WhatsApp button). Delivery in 5 business days.'
        : 'Bonjour ! Notre forfait Site Vitrine démarre à 40 000 FCFA (3 à 7 pages adaptées mobile, SEO et intégration WhatsApp). Réception sous 5 jours ouvrés.',
      takeoverReply: isEn
        ? 'Hello, project manager taking over. Would you be available for a brief scoping call tomorrow at 10 AM?'
        : 'Bonjour, ici le chef de projet web. Êtes-vous disponible demain à 10h pour un échange rapide sur vos besoins ?',
      model: 'Whisper INT8 Local + BYOK',
      ragSources: 'Grille Tarifaire Services.pdf',
    },
    booking: {
      title: isEn ? 'Medical & Clinic' : 'Clinique & Rendez-vous',
      clientMessage: isEn
        ? 'Hello, is an ultrasound slot open tomorrow morning at Akwa?'
        : 'Bonjour, reste-t-il une place pour une échographie demain matin au centre d’Akwa ?',
      isAudio: false,
      botReply: isEn
        ? 'Hello! Dr. Kamga has openings tomorrow at 9:30 AM and 11:15 AM at the Akwa center. Which time works best for you?'
        : 'Bonjour ! Deux créneaux sont disponibles demain à 9h30 et 11h15 au centre d’Akwa avec le Dr. Kamga. Quel horaire préférez-vous ?',
      takeoverReply: isEn
        ? 'Reception desk: Your appointment is booked for 9:30 AM. Please bring your prescription.'
        : 'Accueil médical : Votre créneau de 9h30 est bien réservé. Merci d’apporter votre ordonnance.',
      model: 'BYOK OpenRouter / GPT-4o',
      ragSources: 'Planning Praticiens.txt',
    },
    restaurant: {
      title: isEn ? 'Dining & Restaurant' : 'Restaurant & Traiteur',
      clientMessage: isEn
        ? 'Voice message (0:10): "Good evening, can we reserve a table of 4 for 8 PM tonight?"'
        : 'Message vocal (0:10) : « Bonsoir, est-il possible de réserver une table pour 4 personnes ce soir à 20h ? »',
      isAudio: true,
      audioDuration: '0:10',
      botReply: isEn
        ? 'Good evening! Yes, a table for 4 is reserved for you tonight at 8:00 PM. Our dinner menu features grilled fish and plantains. See you soon!'
        : 'Bonsoir ! C’est noté avec plaisir, votre table de 4 est réservée pour 20h00. Le poisson braisé et les grillades sont à la carte ce soir. À tout de suite !',
      takeoverReply: isEn
        ? 'Floor manager: Table 12 is prepared for your party. Call us if you need directions.'
        : 'Responsable de salle : Votre table est dressée en terrasse. Appelez-nous si vous souhaitez un emplacement spécifique.',
      model: 'Whisper INT8 Local + BYOK',
      ragSources: 'Menu du Jour.pdf',
    },
  };

  const currentScenario = personaScenarios[simPersona];

  return (
    <div className="min-h-screen bg-[#fafafb] text-zinc-900 overflow-x-clip antialiased selection:bg-zinc-900 selection:text-white">
      {/* Sticky Topbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md transition-all duration-200 shadow-2xs">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <BrandLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-600">
            <a href="#solution" className="hover:text-zinc-950 transition-colors">
              {isEn ? 'Solution' : 'Pourquoi Innoica'}
            </a>
            <a href="#architecture" className="hover:text-zinc-950 transition-colors">
              {isEn ? 'Pipeline' : 'Pipeline Souverain'}
            </a>
            <a href="#simulator" className="hover:text-zinc-950 transition-colors">
              {isEn ? 'Simulator' : 'Démonstration'}
            </a>
            <a href="#studio-tour" className="hover:text-zinc-950 transition-colors">
              {isEn ? 'Studio Tour' : 'Interface'}
            </a>
            <a href="#pricing" className="hover:text-zinc-950 transition-colors">
              {isEn ? 'Pricing' : 'Tarifs FCFA'}
            </a>
            <a href="#faq" className="hover:text-zinc-950 transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={switchLocale}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors"
              aria-label="Changer de langue"
            >
              <Globe className="h-3.5 w-3.5 text-zinc-400" />
              <span>{isEn ? 'FR' : 'EN'}</span>
            </button>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
              >
                <span>{isEn ? 'Dashboard' : 'Accéder au Studio'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  {isEn ? 'Sign in' : 'Connexion'}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
                >
                  <span>{isEn ? 'Get started' : 'Démarrer gratuitement'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 bg-white border-b border-zinc-200 p-5 shadow-lg md:hidden space-y-4 animate-fade-in-up">
          <nav className="flex flex-col space-y-2 text-xs font-medium text-zinc-700">
            <a href="#solution" onClick={() => setMobileMenuOpen(false)} className="py-2 flex items-center justify-between">
              <span>{isEn ? 'Solution' : 'Pourquoi Innoica'}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
            <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="py-2 flex items-center justify-between">
              <span>{isEn ? 'Pipeline' : 'Pipeline Souverain'}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
            <a href="#simulator" onClick={() => setMobileMenuOpen(false)} className="py-2 flex items-center justify-between">
              <span>{isEn ? 'Simulator' : 'Démonstration'}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
            <a href="#studio-tour" onClick={() => setMobileMenuOpen(false)} className="py-2 flex items-center justify-between">
              <span>{isEn ? 'Studio Tour' : 'Interface Studio'}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-2 flex items-center justify-between">
              <span>{isEn ? 'Pricing' : 'Tarifs en FCFA'}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="py-2 flex items-center justify-between">
              <span>FAQ</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </a>
          </nav>
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-xs font-medium text-zinc-600">
              Connexion
            </Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-medium">
              Démarrer gratuitement
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 lg:py-20 2xl:py-24 border-b border-zinc-200/80 bg-white">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-zinc-900">INNOICA STUDIO</span>
              <span className="text-zinc-300">|</span>
              <span>Agents WhatsApp & E-commerce natif</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[44px] 2xl:text-5xl font-semibold tracking-tight text-zinc-950 leading-[1.14] animate-fade-in-up animation-delay-75">
              {isEn
                ? 'Automate customer sales and support on WhatsApp. Supervise in real time.'
                : 'Automatisez vos ventes et votre support client sur WhatsApp. Supervisez en direct.'}
            </h1>

            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-2xl animate-fade-in-up">
              {isEn
                ? 'INNOICA is the sovereign WhatsApp Agent Studio engineered with Pairing Code (zero QR code), encrypted Bring-Your-Own-Key (BYOK), local multilingual Whisper voice message comprehension, and instant human takeover.'
                : 'INNOICA est le studio souverain d’agents WhatsApp configuré par Pairing Code (sans aucun QR Code), avec vos propres clés IA chiffrées (BYOK), la compréhension locale des notes vocales par Whisper, et la reprise humaine instantanée.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer min-h-[44px] hover-card-lift"
              >
                <span>{isAuthenticated ? 'Ouvrir mon Studio' : isEn ? 'Start Free (0 FCFA)' : 'Démarrer gratuitement (0 FCFA)'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#simulator"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer min-h-[44px]"
              >
                <Sliders className="h-4 w-4 text-zinc-500" />
                <span>{isEn ? 'Interactive Simulator' : 'Tester le Simulateur & Rentabilité'}</span>
              </a>
            </div>

            {/* Quiet Proof Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-100 text-xs">
              <div className="rounded-xl bg-zinc-50/80 p-3 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-zinc-700" />
                  Pairing Code
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  {isEn ? 'Zero QR code' : 'Sans aucun QR Code'}
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50/80 p-3 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-emerald-600" />
                  Message Vocal
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  Whisper FR & EN inclus
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50/80 p-3 border border-zinc-200/80 hover-card-lift">
                <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-zinc-700" />
                  BYOK Sécurisé
                </div>
                <div className="text-zinc-500 text-[11px] mt-0.5 font-mono">
                  AES-256-GCM chiffré
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50/80 p-3 border border-zinc-200/80 hover-card-lift">
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

          {/* Right Column: Hero Mockup */}
          <div className="lg:col-span-5 animate-fade-in-up">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs space-y-4 hover-card-lift">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-950 ring-1 ring-zinc-800 shrink-0 relative">
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
                    <h3 className="text-xs font-semibold text-zinc-900">INNOICA Studio Engine</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">Douala • Africa/Douala UTC+1</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Actif 24/7</span>
                </div>
              </div>

              {/* Realistic Mini WhatsApp Thread */}
              <div className="rounded-xl bg-[#efeae2]/60 border border-zinc-200/80 p-3.5 space-y-2.5 text-xs font-sans">
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-2xl rounded-tl-xs bg-white border border-zinc-200 p-3 shadow-2xs space-y-1.5">
                    <div className="text-[10px] font-mono text-zinc-400">Contact WhatsApp (+237)</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSimAudioPlaying((v) => !v)}
                        className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
                        aria-label="Lecture audio"
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex items-end gap-[2px] h-5 flex-1">
                        {[6, 12, 18, 10, 14, 20, 8, 16, 22, 14, 8, 12, 18, 16, 10, 6].map((h, i) => (
                          <div
                            key={i}
                            className={`w-[3px] bg-emerald-700/80 rounded-full ${
                              simAudioPlaying ? 'animate-wave-bar' : ''
                            }`}
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">0:14</span>
                    </div>
                    <p className="text-[11px] text-zinc-700 border-t border-zinc-100 pt-1">
                      « Bonjour, vos tarifs pour la création de site vitrine ? »
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] text-zinc-900 border border-emerald-200 px-3 py-2.5 shadow-2xs">
                    <div className="text-[10px] font-mono text-emerald-800 font-medium mb-1 flex items-center justify-between">
                      <span>Assistant Innoica</span>
                      <span>Whisper INT8</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Bonjour ! Notre forfait Site Vitrine est à 40 000 FCFA (3 à 7 pages, mobile responsive, SEO). Nous pouvons commencer dès réception de votre logo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-zinc-500 font-mono border-t border-zinc-100">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  BYOK Clé Chiffrée AES-256
                </span>
                <span className="text-zinc-900 font-semibold">3 500 FCFA / mois</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sovereign Architecture & Flow */}
      <section id="architecture" className="py-16 sm:py-20 lg:py-24 border-b border-zinc-200/80 bg-[#f8f9fa] scroll-mt-16">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 border border-zinc-200 px-3 py-0.5 text-xs font-mono font-medium text-zinc-700">
              <Layers className="h-3.5 w-3.5 text-zinc-700" />
              <span>Pipeline Technologique Souverain</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
              {isEn ? 'How INNOICA Works from Inbound to Outbound' : 'Comment fonctionne le flux WhatsApp de bout en bout'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              {isEn
                ? 'Zero third-party audio costs, strict AES-256 BYOK encryption, and sub-second human intervention.'
                : 'Zéro surcoût vocal, clés chiffrées côté serveur et reprise en main humaine sans temps de latence.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6">
            {/* Step 1 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3 hover-card-lift">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>01</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">Entrant</span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-900">Contact WhatsApp & Pairing Code</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Connexion WebSocket sécurisée via code à 8 caractères. Zéro QR code requis sur PC ou mobile.
              </p>
              <div className="pt-2 border-t border-zinc-100 text-[11px] font-mono text-zinc-500">
                Numéro E.164 (+237)
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3 hover-card-lift">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>02</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-semibold">Whisper INT8</span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Mic className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-900">Transcription Locale</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Speech Worker privé exécutant Faster-Whisper. Transcrit le français et l'anglais sans API payante.
              </p>
              <div className="pt-2 border-t border-zinc-100 text-[11px] font-mono text-emerald-700 font-semibold">
                0 FCFA / minute vocale
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3 hover-card-lift">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>03</span>
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-semibold">BYOK</span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-900">RAG & IA Dédiée</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Injection de vos PDF, fiches et mémoire contact. Appel direct de votre modèle (Gemini, Groq, OpenAI).
              </p>
              <div className="pt-2 border-t border-zinc-100 text-[11px] font-mono text-zinc-500">
                Clé AES-256-GCM
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-2xl border border-zinc-900 bg-zinc-900 text-white p-5 shadow-xs space-y-3 hover-card-lift">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>04</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">Sortant</span>
              </div>
              <div className="h-9 w-9 rounded-xl bg-zinc-800 text-white flex items-center justify-center">
                <Zap className="h-4 w-4 text-emerald-400" />
              </div>
              <h4 className="text-xs font-semibold text-white">Supervision & Réponse</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                L'Inbox reçoit l'échange en direct. L'opérateur peut couper l'IA en 1 clic ou la laisser répondre.
              </p>
              <div className="pt-2 border-t border-zinc-800 text-[11px] font-mono text-emerald-400 font-semibold">
                Reprise Humaine 0ms
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator & Efficiency Score */}
      <section id="simulator" className="py-16 sm:py-20 lg:py-24 border-b border-zinc-200/80 bg-white scroll-mt-16">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 border border-zinc-200 px-3 py-0.5 text-xs font-mono font-medium text-zinc-700">
              <Sliders className="h-3.5 w-3.5" />
              <span>Simulateur d’Agent & Calculateur de Rentabilité</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
              {isEn ? 'Experience your agent live & calculate your savings' : 'Testez un agent en direct et calculez vos économies en FCFA'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              Score d'Efficacité Opérationnelle et rentabilité mensuelle nette.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Chat Simulator */}
            <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                <span className="text-xs font-semibold text-zinc-900">1. Choisissez un profil métier</span>
                <div className="flex items-center gap-1.5">
                  {(['commerce', 'agency', 'booking', 'restaurant'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSimPersona(key);
                        setSimMode('ai');
                        if (key === 'agency') setUnlockedBadges((b) => ({ ...b, testedVocal: true }));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        simPersona === key
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {key === 'commerce' ? 'Commerce' : key === 'agency' ? 'Agence' : key === 'booking' ? 'Clinique' : 'Restaurant'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Viewport */}
              <div className="rounded-xl bg-[#efeae2]/50 border border-zinc-200 p-4 space-y-3 font-sans">
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-white border border-zinc-200 p-3 shadow-2xs space-y-1">
                    <p className="text-[10px] text-zinc-400 font-mono">Client WhatsApp</p>
                    <p className="text-xs text-zinc-800">{currentScenario.clientMessage}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] text-zinc-900 border border-emerald-200 p-3 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-emerald-800 font-mono">
                      <span>{simMode === 'ai' ? 'Réponse IA (Automatique)' : 'Prise de relais humaine'}</span>
                      <span>{simMode === 'ai' ? '1.1s' : 'En direct'}</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      {simMode === 'ai' ? currentScenario.botReply : currentScenario.takeoverReply}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-zinc-500">Mode : <strong>{simMode === 'ai' ? 'Agent IA autonome' : 'Reprise humaine'}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setSimMode((m) => (m === 'ai' ? 'takeover' : 'ai'));
                    setUnlockedBadges((b) => ({ ...b, testedTakeover: true }));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-medium cursor-pointer"
                >
                  {simMode === 'ai' ? 'Simuler reprise humaine' : 'Repasser en mode IA'}
                </button>
              </div>
            </div>

            {/* Right: ROI & Score Card */}
            <div className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Score d'Efficacité Opérationnelle</h3>
                <span className="font-mono font-bold text-sm text-emerald-700">{efficiencyScore} / 100</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Conversations par jour :</span>
                  <span className="font-mono font-bold text-zinc-900">{conversationsPerDay}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={conversationsPerDay}
                  onChange={(e) => setConversationsPerDay(Number(e.target.value))}
                  className="w-full accent-zinc-900 cursor-pointer"
                  aria-label="Nombre de conversations par jour"
                />
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Temps opérateur économisé :</span>
                  <span className="font-mono font-semibold text-zinc-900">{hoursSavedPerMonth} h / mois</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2">
                  <span className="text-zinc-600">Économies brutes estimées :</span>
                  <span className="font-mono font-bold text-emerald-700">{monthlySavingsXaf.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2">
                  <span className="text-zinc-600">Abonnement INNOICA Agent :</span>
                  <span className="font-mono text-zinc-500">3 500 FCFA / mois</span>
                </div>
              </div>

              <div className="text-center pt-1 text-xs text-zinc-600">
                Gain net pour votre entreprise : <strong className="text-zinc-950 font-bold">+{netSavingsXaf.toLocaleString('fr-FR')} FCFA / mois</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Studio Tour Section */}
      <section id="studio-tour" className="py-16 sm:py-20 lg:py-24 border-b border-zinc-200/80 bg-[#f8f9fa] scroll-mt-16">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
              Découvrez l'interface Innoica Studio
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              Un tableau de bord épuré pour gérer vos agents, vos conversations et votre catalogue.
            </p>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex justify-center overflow-x-auto pb-1 studio-scroll">
            <div className="inline-flex items-center gap-1 p-1 bg-zinc-200 rounded-xl text-xs font-medium shrink-0">
              <button
                type="button"
                onClick={() => setActiveStudioTab('inbox')}
                className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeStudioTab === 'inbox' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                innoica.studio — Inbox / Workspace Douala HQ
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('pairing')}
                className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeStudioTab === 'pairing' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                innoica.studio — Connexion WhatsApp / Baileys Pairing Code
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('knowledge')}
                className={`px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeStudioTab === 'knowledge' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                innoica.studio — Base de Connaissances & RAG Vectoriel
              </button>
            </div>
          </div>

          {/* Active Tab Mockup Viewport */}
          <div className="max-w-5xl mx-auto rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 shadow-xs">
            {activeStudioTab === 'inbox' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900">innoica.studio — Inbox / Workspace Douala HQ</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-mono">Temps réel</span>
                  </div>
                  <span className="text-zinc-400 font-mono text-[11px]">8 conversations actives</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <p className="font-semibold text-zinc-900">+237 695 923 604</p>
                    <p className="text-[11px] text-zinc-500">« Demande de catalogue polo »</p>
                    <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-mono">Agent IA actif</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <p className="font-semibold text-zinc-900">+237 671 440 119</p>
                    <p className="text-[11px] text-zinc-500">« Confirmation livraison Bonapriso »</p>
                    <span className="inline-block mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-mono">Prise de main</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                    <p className="font-semibold text-zinc-900">+33 6 42 18 90 12</p>
                    <p className="text-[11px] text-zinc-500">« Devis Site Vitrine 40 000 FCFA »</p>
                    <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-mono">Agent IA actif</span>
                  </div>
                </div>
              </div>
            )}

            {activeStudioTab === 'pairing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 text-xs">
                  <span className="font-semibold text-zinc-900">innoica.studio — Connexion WhatsApp / Baileys Pairing Code</span>
                  <span className="text-zinc-400 font-mono text-[11px]">WhatsApp • 100%</span>
                </div>
                <div className="p-6 rounded-xl bg-zinc-50 border border-zinc-200 text-center space-y-3 max-w-md mx-auto">
                  <p className="text-xs font-semibold text-zinc-700">Lier avec un numéro de téléphone</p>
                  <p className="text-xs text-zinc-500">Entrez ce code dans WhatsApp &gt; Appareils connectés sur votre smartphone :</p>
                  <div className="p-3 rounded-xl bg-white border border-zinc-300 font-mono text-xl font-bold tracking-widest text-zinc-900 inline-block">
                    INNO-8492
                  </div>
                  <p className="text-[11px] text-zinc-400">Expire dans 120s • Connexion automatique</p>
                </div>
              </div>
            )}

            {activeStudioTab === 'knowledge' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3 text-xs">
                  <span className="font-semibold text-zinc-900">innoica.studio — Base de Connaissances & RAG Vectoriel</span>
                  <span className="text-zinc-400 font-mono text-[11px]">3 sources synchronisées</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-zinc-900">Catalogue-Produits-2026.pdf</p>
                      <p className="text-[11px] text-zinc-500 font-mono">24 pages • 48 articles indexés</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Indexé</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-zinc-900">FAQ-Livraison-Cameroun.txt</p>
                      <p className="text-[11px] text-zinc-500 font-mono">Zones Douala & Yaoundé</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Indexé</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-20 lg:py-24 border-b border-zinc-200/80 bg-white scroll-mt-16">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 space-y-12">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-zinc-950">
              Tarification simple et transparente
            </h2>
            <p className="text-sm text-zinc-600">
              Réglez en FCFA par Orange Money, MTN MoMo ou carte bancaire. Aucun engagement.
            </p>

            <div className="inline-flex items-center rounded-xl bg-zinc-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  billingCycle === 'monthly' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600'
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  billingCycle === 'yearly' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600'
                }`}
              >
                Annuel (-10%)
              </button>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              isStoreModuleEnabled ? 'md:grid-cols-3 max-w-6xl' : 'md:grid-cols-2 max-w-4xl'
            } gap-6 lg:gap-8 mx-auto items-stretch`}
          >
            {/* Plan Free */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs hover-card-lift">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-950">Découverte</h3>
                  <p className="text-xs text-zinc-500 mt-1">Pour tester sans engagement la connexion WhatsApp.</p>
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-black text-zinc-950">0 FCFA</span>
                  <span className="text-xs text-zinc-500 ml-1">/ mois</span>
                </div>
                <ul className="space-y-2.5 text-xs text-zinc-600 pt-2 border-t border-zinc-100">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-zinc-700 shrink-0" />
                    <span>1 agent WhatsApp de test</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-zinc-700 shrink-0" />
                    <span>50 messages mensuels inclus</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-zinc-700 shrink-0" />
                    <span>Connexion par code de jumelage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-zinc-700 shrink-0" />
                    <span>Support communautaire & BYOK</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register"
                className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 text-center transition-colors"
              >
                Démarrer gratuitement
              </Link>
            </div>

            {/* Plan Agent */}
            <div
              className={`rounded-2xl bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 relative hover-card-lift ${
                !isStoreModuleEnabled
                  ? 'border-2 border-zinc-900 shadow-md'
                  : 'border border-zinc-300 shadow-xs'
              }`}
            >
              {!isStoreModuleEnabled && (
                <span className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-semibold tracking-wider uppercase">
                  Recommandé
                </span>
              )}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-950">INNOICA Agent</h3>
                  <p className="text-xs text-zinc-500 mt-1">Pour les professionnels gérant des requêtes et ventes WhatsApp.</p>
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-black text-zinc-950">
                    {billingCycle === 'yearly' ? '3 150' : '3 500'} FCFA
                  </span>
                  <span className="text-xs text-zinc-500 ml-1">/ mois</span>
                </div>
                <ul className="space-y-2.5 text-xs text-zinc-700 pt-2 border-t border-zinc-100">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Agent WhatsApp autonome illimité</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Transcription vocale Whisper intégrée</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Base de connaissances PDF & FAQ</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Clés IA privées chiffrées (BYOK)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Boîte de réception & reprise en 1 clic</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=starter"
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white text-center transition-colors shadow-xs"
              >
                Choisir INNOICA Agent
              </Link>
            </div>

            {/* Plan Commerce - Shown when store module is enabled */}
            {isStoreModuleEnabled && (
              <div className="rounded-2xl border-2 border-zinc-900 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-md relative hover-card-lift">
                <span className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-semibold tracking-wider uppercase">
                  Recommandé
                </span>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950">INNOICA Commerce</h3>
                    <p className="text-xs text-zinc-500 mt-1">Pour les commerçants souhaitant une boutique en ligne et un agent synchronisé.</p>
                  </div>
                  <div className="pt-2">
                    <span className="text-3xl font-black text-zinc-950">
                      {billingCycle === 'yearly' ? '5 850' : '6 500'} FCFA
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">/ mois</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-700 pt-2 border-t border-zinc-100">
                    <li className="flex items-center gap-2 font-medium text-zinc-900">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Toutes les fonctionnalités INNOICA Agent</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Site e-commerce natif hébergé</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Catalogue avec variantes (tailles, couleurs)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Panier & commandes clients</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Alertes WhatsApp instantanées par commande</span>
                    </li>
                  </ul>
                </div>
                <Link
                  href="/register?plan=pro"
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white text-center transition-colors shadow-xs"
                >
                  Choisir INNOICA Commerce
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-20 lg:py-24 border-b border-zinc-200/80 bg-white scroll-mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
              Questions fréquentes
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              Tout ce que vous devez savoir pour démarrer avec INNOICA.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Faut-il scanner un QR code pour connecter WhatsApp ?',
                a: 'Non. INNOICA utilise la méthode moderne par Pairing Code (code de jumelage à 8 caractères). Vous saisissez votre numéro de téléphone et validez le code directement dans WhatsApp sur votre smartphone sans avoir besoin d’un deuxième écran.',
              },
              {
                q: 'L’agent comprend-il les messages vocaux envoyés par les clients ?',
                a: 'Oui. Le moteur Faster-Whisper est intégré directement à notre infrastructure. Il transcrit automatiquement les notes vocales en français et en anglais sans surcoût par minute.',
              },
              {
                q: 'Comment fonctionne la boutique e-commerce avec l’agent ?',
                a: 'Votre boutique en ligne est hébergée directement sur INNOICA. Lorsque vous ajoutez ou modifiez des produits et des variantes (prix, tailles, stock), votre agent WhatsApp en a immédiatement connaissance et peut orienter les clients avec un lien de commande direct.',
              },
              {
                q: 'Puis-je reprendre la main en direct sur une discussion ?',
                a: 'Oui. Depuis votre boîte de réception unifiée, un simple bouton vous permet de désactiver l’agent sur une conversation précise et de répondre directement à votre client.',
              },
              {
                q: 'Quels sont les moyens de paiement acceptés pour l’abonnement ?',
                a: 'Nous acceptons Orange Money Cameroun, MTN Mobile Money et les cartes bancaires internationales (Visa, Mastercard). Les transactions sont en FCFA sans frais de change.',
              },
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/80 transition-colors"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-zinc-900">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-zinc-700' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-zinc-950 text-white">
        <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">INNOICA</span>
            <span>•</span>
            <span>Douala, Cameroun</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Politique de confidentialité
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Conditions d’utilisation
            </Link>
            <Link href="/legal" className="hover:text-white transition-colors">
              Mentions légales
            </Link>
          </div>

          <p className="text-[11px] text-zinc-500 font-mono">
            © {new Date().getFullYear()} INNOICA. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
