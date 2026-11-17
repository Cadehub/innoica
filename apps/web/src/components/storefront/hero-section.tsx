import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-builder';

export interface HeroSettings {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  ctaText?: string;
  ctaLink?: string;
  imageUrl?: string;
  alignment?: 'left' | 'center' | 'right';
}

interface HeroSectionProps {
  settings?: HeroSettings;
  themeColor?: string;
  storeSlug?: string;
}

export function HeroSection({
  settings = {},
  themeColor = '#25D366',
  storeSlug = '',
}: HeroSectionProps) {
  const title = sanitizeText(settings.title || 'Bienvenue dans notre boutique');
  const subtitle = sanitizeText(
    settings.subtitle || 'Découvrez nos articles de qualité et profitez d’une livraison express partout au Cameroun.'
  );
  const badgeText = sanitizeText(settings.badgeText || 'Collection Officielle 2026');
  const ctaText = sanitizeText(settings.ctaText || 'Découvrir nos offres');
  const ctaLink = sanitizeUrl(settings.ctaLink || '#catalog');
  const imageUrl = sanitizeUrl(settings.imageUrl || '', '');

  return (
    <section className="relative overflow-hidden bg-zinc-950 text-white rounded-2xl md:rounded-3xl mx-3 sm:mx-4 md:mx-6 my-4 shadow-xl border border-zinc-800">
      {/* Dynamic background glow based on themeColor */}
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />

      <div className="relative z-10 px-5 py-10 sm:px-8 sm:py-14 md:py-16 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-8 max-w-7xl mx-auto">
        <div className="flex-1 text-center md:text-left space-y-4 max-w-2xl">
          {badgeText && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-white/10 backdrop-blur-md border border-white/15 text-white">
              <Sparkles className="h-3 w-3 shrink-0" style={{ color: themeColor }} />
              <span>{badgeText}</span>
            </div>
          )}

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight sm:leading-tight">
            {title}
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-zinc-300 max-w-xl leading-relaxed">
            {subtitle}
          </p>

          <div className="pt-2 flex flex-wrap gap-3 justify-center md:justify-start">
            <Link
              href={ctaLink}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-zinc-950 shadow-lg hover:brightness-105 active:scale-98 transition-all cursor-pointer"
              style={{ backgroundColor: themeColor }}
            >
              <span>{ctaText}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {imageUrl ? (
          <div className="shrink-0 w-full md:w-80 lg:w-96 aspect-square rounded-2xl overflow-hidden bg-zinc-900/60 border border-zinc-800 shadow-inner flex items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="shrink-0 w-full md:w-80 lg:w-96 aspect-4/3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center mb-1 text-zinc-950"
              style={{ backgroundColor: themeColor }}
            >
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-white tracking-wide">Qualité & Authenticité 100%</p>
            <p className="text-xs text-zinc-400">Commandez en direct avec le commerçant au Cameroun</p>
          </div>
        )}
      </div>
    </section>
  );
}
