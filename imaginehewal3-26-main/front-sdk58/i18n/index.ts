/**
 * Minimal i18n. English, French and Arabic are translated. Twi (tw), Ewe (ee), Hausa (ha) and Ga (gaa) are wired in
 * and fall back to English key by key until native speakers fill in their files in ./locales. Do not machine-translate
 * emergency text: have a native speaker and a clinician review it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, I18nManager, Platform } from 'react-native';
import ar from './locales/ar';
import en from './locales/en';
import ee from './locales/ee';
import fr from './locales/fr';
import gaa from './locales/gaa';
import ha from './locales/ha';
import tw from './locales/tw';

export type Lang = 'en' | 'fr' | 'ar' | 'tw' | 'ee' | 'ha' | 'gaa';
export const LANGUAGES: { code: Lang; label: string; translated: boolean }[] = [
  { code: 'en', label: 'English', translated: true }, { code: 'fr', label: 'Français', translated: true },
  { code: 'ar', label: 'العربية', translated: true }, { code: 'tw', label: 'Twi', translated: false },
  { code: 'ee', label: 'Eʋegbe (Ewe)', translated: false }, { code: 'ha', label: 'Hausa', translated: false },
  { code: 'gaa', label: 'Ga', translated: false },
];
const PACKS: Record<Lang, Record<string, string>> = { en, fr, ar, tw, ee, ha, gaa };
const KEY = 'hewal3_lang';
let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang { return current; }
export async function setLang(lang: Lang, persist = true): Promise<void> {
  if (!PACKS[lang]) return;
  current = lang;
  applyDirection(lang);
  if (persist) { try { await AsyncStorage.setItem(KEY, lang); } catch { /* storage unavailable */ } }
  listeners.forEach((l) => l(lang));
}
export async function loadLang(): Promise<void> {
  try { const saved = (await AsyncStorage.getItem(KEY)) as Lang | null; if (saved && PACKS[saved]) { current = saved; listeners.forEach((l) => l(saved)); } } catch { /* ignore */ }
}

/** Translate a key, falling back to English, then to the key itself. Supports {placeholders}. */
export function t(key: string, vars?: Record<string, string | number>, lang: Lang = current): string {
  let s = PACKS[lang]?.[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}
export const isRtl = (lang: Lang = current) => lang === 'ar';

export function useT() {
  const [lang, setL] = useState<Lang>(current);
  useEffect(() => { loadLang(); listeners.add(setL); return () => { listeners.delete(setL); }; }, []);
  return { lang, t: (key: string, vars?: Record<string, string | number>) => t(key, vars, lang), rtl: isRtl(lang) };
}

const RESTART: Record<string, string> = {
  en: 'Close and reopen the app to switch the screen direction.',
  fr: "Fermez puis rouvrez l'application pour changer le sens de l'écran.",
  ar: 'أغلق التطبيق ثم افتحه مجددًا لتغيير اتجاه الشاشة.',
};
/** Arabic reads right to left. React Native only applies a direction change after a restart, so ask once and remember the choice either way. */
function applyDirection(lang: Lang) {
  if (Platform.OS === 'web') return;
  const rtl = isRtl(lang);
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(rtl);                                   // also cancels a pending switch if the person changed their mind
    if (I18nManager.isRTL !== rtl) Alert.alert('', RESTART[lang] || RESTART.en);
  } catch { /* the direction is a nicety; the text still shows */ }
}
