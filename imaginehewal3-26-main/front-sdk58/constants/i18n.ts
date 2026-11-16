/**
 * Language support for fixed screen text. Only phrases listed here are translated; everything else stays in English, so a screen
 * is never half-broken. Add a language by adding a table. Twi is a PREVIEW: a small set of everyday words that must be reviewed by
 * a native speaker before any wider use. Health advice itself is never machine-translated.
 */
export type LanguageCode = 'en' | 'tw';

export const LANGUAGES: { code: LanguageCode; label: string; note?: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi (preview)', note: 'A small set of everyday words for now' },
];

const TWI: Record<string, string> = {
  'Good morning': 'Mema wo akye',
  'Good afternoon': 'Mema wo aha',
  'Good evening': 'Mema wo adwo',
  'Thank you': 'Meda wo ase',
  'Yes': 'Aane',
  'No': 'Daabi',
  'Home': 'Fie',
  'Health': 'Ahoɔden',
  'Steps': 'Anammɔn',
  'Heart rate': 'Koma bɔ',
  'Water': 'Nsuo',
  'Medicine': 'Aduro',
  'Medicines': 'Aduro',
  'Doctor': 'Ɔdɔkota',
  'Help': 'Mmoa',
  'Save': 'Sie',
};

const TABLES: Record<string, Record<string, string>> = { tw: TWI };
const GREETING = /^(Good morning|Good afternoon|Good evening)(,?\s.*)?$/;

export function translate(text: string, lang: string): string {
  const table = TABLES[lang];
  if (!table || !text) return text;
  const trimmed = text.trim();
  if (table[trimmed]) return text.replace(trimmed, table[trimmed]);
  const g = GREETING.exec(trimmed);
  if (g && table[g[1]]) return text.replace(g[1], table[g[1]]);          // "Good morning, Kofi" -> "Mema wo akye, Kofi"
  return text;
}
