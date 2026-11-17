import React from 'react';
import { Tag } from 'lucide-react';
import { sanitizeText } from '@/lib/sanitize-builder';

interface AnnouncementBarProps {
  enabled?: boolean;
  text?: string;
  themeColor?: string;
}

export function AnnouncementBar({
  enabled = true,
  text = 'Livraison express à Douala & Yaoundé • Retrait gratuit en boutique',
  themeColor = '#25D366',
}: AnnouncementBarProps) {
  if (!enabled || !text) return null;

  const safeText = sanitizeText(text);
  if (!safeText) return null;

  return (
    <aside
      aria-label="Annonce boutique"
      className="w-full text-white text-[11px] font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 select-none shadow-xs transition-colors"
      style={{ backgroundColor: themeColor }}
    >
      <Tag className="h-3 w-3 shrink-0 opacity-80" />
      <span className="truncate max-w-4xl tracking-wide">{safeText}</span>
    </aside>
  );
}
