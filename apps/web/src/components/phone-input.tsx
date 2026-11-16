'use client';

import { COUNTRY_DIAL_CODES, formatE164Phone, parseE164Phone } from '@innoica/shared';

interface PhoneInputProps {
  value: string;
  onChange: (e164Value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled = false,
  placeholder = '691234567',
  id,
}: PhoneInputProps) {
  const { dialCode, localNumber } = parseE164Phone(value);

  const handleCountryChange = (newDialCode: string) => {
    onChange(formatE164Phone(newDialCode, localNumber));
  };

  const handleLocalChange = (rawInput: string) => {
    const digitsOnly = rawInput.replace(/\D/g, '');
    onChange(formatE164Phone(dialCode, digitsOnly));
  };

  return (
    <div className="flex w-full rounded-lg border border-zinc-200 bg-white overflow-hidden focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 shadow-2xs">
      <select
        aria-label="Indicatif pays"
        value={dialCode}
        onChange={(e) => handleCountryChange(e.target.value)}
        disabled={disabled}
        className="min-h-[40px] max-w-[145px] sm:max-w-[175px] shrink-0 bg-zinc-50 border-r border-zinc-200 px-2.5 py-2 text-xs font-semibold text-zinc-800 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400 cursor-pointer font-mono"
      >
        {COUNTRY_DIAL_CODES.map((c) => (
          <option key={`${c.iso}-${c.dialCode}`} value={c.dialCode}>
            {c.iso} (+{c.dialCode}) - {c.name}
          </option>
        ))}
      </select>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[40px] w-full min-w-0 px-3 py-2 text-xs text-zinc-900 font-mono tabular-nums focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
      />
    </div>
  );
}
