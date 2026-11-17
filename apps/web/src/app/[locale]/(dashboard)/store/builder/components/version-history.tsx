'use client';

import React from 'react';
import { History, RotateCcw, Clock, Check } from 'lucide-react';

interface Snapshot {
  themeColor: string;
  sections: any[];
  announcement?: { enabled: boolean; text: string };
  publishedAt: string;
  version: number;
}

interface VersionHistoryProps {
  history: Snapshot[];
  onRestore: (snapshot: Snapshot) => void;
}

export function VersionHistory({ history = [], onRestore }: VersionHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-center space-y-1 antialiased">
        <History className="h-5 w-5 mx-auto text-zinc-400" />
        <p className="text-xs font-bold text-zinc-700">Aucun historique disponible</p>
        <p className="text-[10px] text-zinc-400">
          Les 5 dernières versions publiées apparaîtront ici pour un retour en 1 clic.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 antialiased">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-800">
          Historique des Versions ({history.length}/5)
        </label>
        <span className="text-[10px] text-zinc-400">Restauration en 1 clic</span>
      </div>

      <div className="space-y-2">
        {history.map((snap, idx) => {
          const dateStr = snap.publishedAt
            ? new Date(snap.publishedAt).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : `Version ${snap.version || idx + 1}`;

          return (
            <div
              key={idx}
              className="p-3 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 transition-all flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-4 w-4 rounded-full border border-zinc-300 shrink-0 shadow-2xs"
                  style={{ backgroundColor: snap.themeColor || '#25D366' }}
                />
                <div className="min-w-0">
                  <p className="font-bold text-zinc-900 truncate">
                    Version #{snap.version || history.length - idx}
                  </p>
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{dateStr}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRestore(snap)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-[11px] font-bold text-zinc-700 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restaurer</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
