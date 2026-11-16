// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Country Dial Codes (Zero Emoji)
// ====================================================================

export interface CountryDialCode {
  iso: string;
  name: string;
  dialCode: string; // digits without '+'
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  // Marché principal : Cameroun & Afrique francophone
  { iso: 'CM', name: 'Cameroun', dialCode: '237' },
  { iso: 'CI', name: "Côte d'Ivoire", dialCode: '225' },
  { iso: 'SN', name: 'Sénégal', dialCode: '221' },
  { iso: 'GA', name: 'Gabon', dialCode: '241' },
  { iso: 'CG', name: 'Congo-Brazzaville', dialCode: '242' },
  { iso: 'CD', name: 'RD Congo', dialCode: '243' },
  { iso: 'BJ', name: 'Bénin', dialCode: '229' },
  { iso: 'TG', name: 'Togo', dialCode: '228' },
  { iso: 'ML', name: 'Mali', dialCode: '223' },
  { iso: 'BF', name: 'Burkina Faso', dialCode: '226' },
  { iso: 'NE', name: 'Niger', dialCode: '227' },
  { iso: 'GN', name: 'Guinée', dialCode: '224' },
  { iso: 'TD', name: 'Tchad', dialCode: '235' },
  { iso: 'CF', name: 'Centrafrique', dialCode: '236' },
  { iso: 'GQ', name: 'Guinée équatoriale', dialCode: '240' },
  { iso: 'MG', name: 'Madagascar', dialCode: '261' },
  { iso: 'BI', name: 'Burundi', dialCode: '257' },
  { iso: 'RW', name: 'Rwanda', dialCode: '250' },
  { iso: 'DJ', name: 'Djibouti', dialCode: '253' },
  { iso: 'KM', name: 'Comores', dialCode: '269' },
  { iso: 'MR', name: 'Mauritanie', dialCode: '222' },
  // Afrique du Nord & reste de l'Afrique
  { iso: 'MA', name: 'Maroc', dialCode: '212' },
  { iso: 'TN', name: 'Tunisie', dialCode: '216' },
  { iso: 'DZ', name: 'Algérie', dialCode: '213' },
  { iso: 'NG', name: 'Nigeria', dialCode: '234' },
  { iso: 'GH', name: 'Ghana', dialCode: '233' },
  { iso: 'KE', name: 'Kenya', dialCode: '254' },
  { iso: 'ZA', name: 'Afrique du Sud', dialCode: '27' },
  { iso: 'EG', name: 'Égypte', dialCode: '20' },
  // Europe
  { iso: 'FR', name: 'France', dialCode: '33' },
  { iso: 'BE', name: 'Belgique', dialCode: '32' },
  { iso: 'CH', name: 'Suisse', dialCode: '41' },
  { iso: 'LU', name: 'Luxembourg', dialCode: '352' },
  { iso: 'GB', name: 'Royaume-Uni', dialCode: '44' },
  { iso: 'DE', name: 'Allemagne', dialCode: '49' },
  { iso: 'ES', name: 'Espagne', dialCode: '34' },
  { iso: 'IT', name: 'Italie', dialCode: '39' },
  { iso: 'PT', name: 'Portugal', dialCode: '351' },
  { iso: 'NL', name: 'Pays-Bas', dialCode: '31' },
  // Amériques & International
  { iso: 'US', name: 'États-Unis / Canada', dialCode: '1' },
  { iso: 'BR', name: 'Brésil', dialCode: '55' },
  { iso: 'AE', name: 'Émirats arabes unis', dialCode: '971' },
  { iso: 'SA', name: 'Arabie saoudite', dialCode: '966' },
  { iso: 'CN', name: 'Chine', dialCode: '86' },
  { iso: 'IN', name: 'Inde', dialCode: '91' },
  { iso: 'JP', name: 'Japon', dialCode: '81' },
];

/**
 * Splits an E.164 phone string (e.g. "+237691234567") into { dialCode, localNumber }.
 * Matches longest dialCode first to avoid prefix collisions (e.g. +1 vs +237).
 */
export function parseE164Phone(value: string, fallbackDialCode = '237'): {
  dialCode: string;
  localNumber: string;
} {
  const cleaned = (value || '').replace(/[^\d+]/g, '');
  if (!cleaned) {
    return { dialCode: fallbackDialCode, localNumber: '' };
  }

  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);

  for (const country of sorted) {
    if (digits.startsWith(country.dialCode)) {
      return {
        dialCode: country.dialCode,
        localNumber: digits.slice(country.dialCode.length),
      };
    }
  }

  return { dialCode: fallbackDialCode, localNumber: digits };
}

/**
 * Combines a country dial code and local digits into normalized E.164 format (+237691234567).
 */
export function formatE164Phone(dialCode: string, localNumber: string): string {
  const cleanDial = dialCode.replace(/\D/g, '');
  const cleanLocal = localNumber.replace(/\D/g, '');
  return `+${cleanDial}${cleanLocal}`;
}
