import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface StockBadgeProps {
  quantity: number;
  trackStock?: boolean;
}

export function StockBadge({ quantity, trackStock = true }: StockBadgeProps) {
  if (!trackStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Disponible
      </span>
    );
  }

  if (quantity <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="h-3 w-3" />
        Rupture de stock
      </span>
    );
  }

  if (quantity <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3" />
        Plus que {quantity} en stock !
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      En stock ({quantity})
    </span>
  );
}
