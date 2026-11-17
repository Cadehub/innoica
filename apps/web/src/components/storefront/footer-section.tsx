import React from 'react';
import Link from 'next/link';
import { Phone, MapPin, ShieldCheck, Heart } from 'lucide-react';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-builder';

export interface FooterSettings {
  copyright?: string;
  contactPhone?: string;
  contactAddress?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
}

interface FooterSectionProps {
  settings?: FooterSettings;
  themeColor?: string;
  storeName?: string;
  storeSlug?: string;
}

export function FooterSection({
  settings = {},
  themeColor = '#25D366',
  storeName = 'Boutique Officielle',
  storeSlug = '',
}: FooterSectionProps) {
  const currentYear = new Date().getFullYear();
  const copyright = sanitizeText(settings.copyright || `© ${currentYear} ${storeName}. Tous droits réservés.`);
  const contactPhone = sanitizeText(settings.contactPhone || '');
  const contactAddress = sanitizeText(settings.contactAddress || 'Cameroun');

  return (
    <footer className="mt-12 border-t border-zinc-200/80 bg-white text-zinc-600 antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand & Bio */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: themeColor }}
            />
            <span className="font-black text-base text-zinc-900 tracking-tight">
              {storeName}
            </span>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
            Votre destination shopping de confiance. Produits authentiques, livraison rapide et service client dédié.
          </p>
          <div className="pt-1 flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            <span>Paiement & Commandes Sécurisés</span>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Contact & Support
          </h2>
          <ul className="space-y-2 text-xs text-zinc-500">
            {contactAddress && (
              <li className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span>{contactAddress}</span>
              </li>
            )}
            {contactPhone && (
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <a href={`tel:${contactPhone}`} className="hover:text-zinc-900 transition-colors">
                  {contactPhone}
                </a>
              </li>
            )}
          </ul>
        </div>

        {/* Quick links & Platform */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Navigation Rapide
          </h2>
          <ul className="space-y-1.5 text-xs text-zinc-500">
            <li>
              <Link href={`/store/${storeSlug}`} className="hover:text-zinc-900 transition-colors">
                Accueil de la boutique
              </Link>
            </li>
            <li>
              <Link href={`/store/${storeSlug}/catalog`} className="hover:text-zinc-900 transition-colors">
                Catalogue complet
              </Link>
            </li>
            <li>
              <Link href={`/store/${storeSlug}/checkout`} className="hover:text-zinc-900 transition-colors">
                Validation de commande
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar with INNOICA Watermark */}
      <div className="border-t border-zinc-100 bg-zinc-50/70 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[11px] text-zinc-400">
          <div>{copyright}</div>
          <div className="inline-flex items-center gap-1.5">
            <span>Propulsé par</span>
            <a
              href="https://innoica.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-zinc-700 hover:text-zinc-900 transition-colors"
            >
              INNOICA Commerce
            </a>
            <span>• Douala, Cameroun</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
