import React from 'react';
import { Store, MapPin, Phone, MessageCircle } from 'lucide-react';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-builder';

export interface AboutSettings {
  title?: string;
  body?: string;
  imageUrl?: string;
  locationText?: string;
  contactPhone?: string;
}

interface AboutSectionProps {
  settings?: AboutSettings;
  themeColor?: string;
}

export function AboutSection({
  settings = {},
  themeColor = '#25D366',
}: AboutSectionProps) {
  const title = sanitizeText(settings.title || 'À Propos de Notre Boutique');
  const body = sanitizeText(
    settings.body ||
      'Votre boutique de référence au Cameroun. Nous sélectionnons avec rigueur les meilleurs articles pour vous offrir un service fiable et de haute qualité.'
  );
  const locationText = sanitizeText(settings.locationText || 'Douala & Yaoundé, Cameroun');
  const contactPhone = sanitizeText(settings.contactPhone || '');
  const imageUrl = sanitizeUrl(settings.imageUrl || '', '');

  return (
    <section className="px-3 sm:px-4 md:px-6 my-8 max-w-7xl mx-auto" id="about">
      <div className="rounded-2xl md:rounded-3xl bg-white border border-zinc-200/80 p-6 sm:p-8 md:p-10 shadow-xs flex flex-col md:flex-row items-center gap-8">
        {imageUrl ? (
          <div className="w-full md:w-1/3 aspect-4/3 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="w-full md:w-1/3 aspect-4/3 rounded-2xl flex flex-col items-center justify-center p-6 text-center shrink-0 border border-zinc-200"
            style={{ backgroundColor: `${themeColor}10` }}
          >
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mb-2 shadow-xs text-zinc-950"
              style={{ backgroundColor: themeColor }}
            >
              <Store className="h-7 w-7" />
            </div>
            <p className="text-sm font-bold text-zinc-800 tracking-wide">Commerçant Agréé</p>
            <p className="text-[11px] text-zinc-500">Service client réactif</p>
          </div>
        )}

        <div className="flex-1 space-y-4 text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-zinc-100 text-zinc-700">
            Qui sommes-nous ?
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            {title}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
            {body}
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-600 font-medium border-t border-zinc-100">
            {locationText && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                <span>{locationText}</span>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                <span>{contactPhone}</span>
              </div>
            )}
            {contactPhone && (
              <a
                href={`https://wa.me/${contactPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Discuter sur WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
