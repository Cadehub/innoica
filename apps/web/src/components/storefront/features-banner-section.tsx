import React from 'react';
import { Truck, ShieldCheck, Banknote, MessageCircle, HelpCircle } from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize-builder';

export interface FeatureItem {
  icon?: string;
  title?: string;
  description?: string;
}

export interface FeaturesBannerSettings {
  items?: FeatureItem[];
}

interface FeaturesBannerSectionProps {
  settings?: FeaturesBannerSettings;
  themeColor?: string;
}

const DEFAULT_ITEMS: FeatureItem[] = [
  {
    icon: 'truck',
    title: 'Livraison Rapide',
    description: 'Douala, Yaoundé et expédition dans tout le Cameroun',
  },
  {
    icon: 'shield',
    title: 'Garantie Authentique',
    description: 'Articles neufs vérifiés et conformes aux normes',
  },
  {
    icon: 'payment',
    title: 'Paiement Flexible',
    description: 'Paiement à la livraison ou Mobile Money manuel',
  },
  {
    icon: 'whatsapp',
    title: 'Support WhatsApp 7j/7',
    description: 'Conseils et assistance directe avec votre commerçant',
  },
];

function renderIcon(iconName?: string, themeColor: string = '#25D366') {
  const iconProps = { className: 'h-5 w-5 shrink-0', style: { color: themeColor } };
  switch (iconName?.toLowerCase()) {
    case 'truck':
      return <Truck {...iconProps} />;
    case 'shield':
    case 'shield-check':
      return <ShieldCheck {...iconProps} />;
    case 'payment':
    case 'banknote':
    case 'credit-card':
      return <Banknote {...iconProps} />;
    case 'whatsapp':
    case 'headphones':
    case 'message-circle':
      return <MessageCircle {...iconProps} />;
    default:
      return <HelpCircle {...iconProps} />;
  }
}

export function FeaturesBannerSection({
  settings = {},
  themeColor = '#25D366',
}: FeaturesBannerSectionProps) {
  const items = settings.items && settings.items.length > 0 ? settings.items : DEFAULT_ITEMS;

  return (
    <section className="px-3 sm:px-4 md:px-6 my-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-xs">
        {items.slice(0, 4).map((item, index) => {
          const title = sanitizeText(item.title || '');
          const description = sanitizeText(item.description || '');

          return (
            <div
              key={index}
              className="flex items-start gap-3 p-2 rounded-xl hover:bg-zinc-50 transition-colors"
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-zinc-200/60"
                style={{ backgroundColor: `${themeColor}15` }}
              >
                {renderIcon(item.icon, themeColor)}
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-zinc-900 truncate">{title}</h2>
                <p className="text-[11px] text-zinc-500 line-clamp-2 leading-tight mt-0.5">
                  {description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
