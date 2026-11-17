'use client';

import React, { useState, useEffect } from 'react';
import { hexColorRegex } from '@innoica/shared';
import { Check } from 'lucide-react';

export const THEME_PRESETS = [
  { name: 'Oraimo Neon Green', hex: '#00DF59' },
  { name: 'WhatsApp Émeraude', hex: '#25D366' },
  { name: 'Bleu Minuit', hex: '#1E40AF' },
  { name: 'Violet Royal', hex: '#7C3AED' },
  { name: 'Orange Sunset', hex: '#EA580C' },
  { name: 'Rouge Rubis', hex: '#E11D48' },
  { name: 'Cyan Lagon', hex: '#0D9488' },
  { name: 'Onyx Noir', hex: '#18181B' },
];

interface ColorPalettePickerProps {
  color: string;
  onChange: (hex: string) => void;
}

export function ColorPalettePicker({ color, onChange }: ColorPalettePickerProps) {
  const [customInput, setCustomInput] = useState(color);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomInput(color);
    setError(null);
  }, [color]);

  const handleCustomChange = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) {
      clean = `#${clean}`;
    }
    setCustomInput(clean);

    if (hexColorRegex.test(clean)) {
      setError(null);
      onChange(clean);
    } else {
      setError('Format invalide (#RGB ou #RRGGBB)');
    }
  };

  const handlePresetClick = (hex: string) => {
    setCustomInput(hex);
    setError(null);
    onChange(hex);
  };

  return (
    <div className="space-y-3 antialiased">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-800">
          Couleur Thématique Principale
        </label>
        <div className="flex items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-full border border-zinc-300 shadow-2xs"
            style={{ backgroundColor: color }}
          />
          <span className="text-[11px] font-mono font-bold text-zinc-600">{color}</span>
        </div>
      </div>

      {/* 8 Conversion-Tested Presets */}
      <div className="grid grid-cols-4 gap-2">
        {THEME_PRESETS.map((preset) => {
          const isSelected = color.toLowerCase() === preset.hex.toLowerCase();
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => handlePresetClick(preset.hex)}
              title={preset.name}
              className={`h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                isSelected
                  ? 'border-zinc-950 scale-105 shadow-xs'
                  : 'border-transparent hover:scale-102'
              }`}
              style={{ backgroundColor: preset.hex }}
            >
              {isSelected && <Check className="h-4 w-4 text-white drop-shadow-xs" />}
            </button>
          );
        })}
      </div>

      {/* Custom Hex Input */}
      <div className="space-y-1 pt-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Couleur personnalisée (code hex)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="#25D366"
            className="flex-1 px-3 py-1.5 text-xs font-mono rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <input
            type="color"
            value={hexColorRegex.test(color) ? color : '#25D366'}
            onChange={(e) => handlePresetClick(e.target.value)}
            className="h-8 w-8 rounded-lg border border-zinc-200 cursor-pointer p-0 bg-transparent"
          />
        </div>
        {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
      </div>
    </div>
  );
}
