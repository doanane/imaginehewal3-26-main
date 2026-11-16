import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance } from 'react-native';
import { isDarkMode, makeMapper, Mapper } from '../constants/themeEngine';
import { Lang, setLang } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import api, { AccessibilitySettings } from '../services/api';
import { explainNoSpeech, speak as speakText } from '../services/speech';
import { realtime } from '../services/realtime';

const STORAGE_KEY = 'hewal3_home_accessibility';

export type Contrast = 'default' | 'high' | 'dark' | 'yellow' | 'sepia';
export type HomeAccessibilitySettings = {
  fontSize: number;
  contrast: Contrast;
  colorBlind: string;
  grayscale: boolean;
  saturation: number;
  dimmer: number;
  zoom: number;
  hideImages: boolean;
  boldText: boolean;
  underlineLinks: boolean;
  highlightLinks: boolean;
  stopAnimations: boolean;
  readingGuide: boolean;
  keyboardNavigation: boolean;    // shown to the user as "Large tap areas"
  screenReader: boolean;          // shown to the user as "Read aloud on long press"
  language: string;
};

export const DEFAULT_HOME_ACCESSIBILITY: HomeAccessibilitySettings = {
  fontSize: 0, contrast: 'default', colorBlind: 'none', grayscale: false, saturation: 0, dimmer: 0, zoom: 0,
  hideImages: false, boldText: false, underlineLinks: false, highlightLinks: false, stopAnimations: false,
  readingGuide: false, keyboardNavigation: false, screenReader: false, language: 'en',
};

type ContextValue = HomeAccessibilitySettings & {
  textScale: number;                  // text size step and page zoom are separate; this is the text size part
  zoomScale: number;
  mapper: Mapper | null;              // null = default colours, nothing to map
  dark: boolean;                      // any of the dark looks (dark, high contrast, yellow on black)
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  update: (key: keyof HomeAccessibilitySettings, value: HomeAccessibilitySettings[keyof HomeAccessibilitySettings]) => void;
  reset: () => void;
  toggleDark: () => void;             // the light/dark switch at the top of the screens
  speak: (text: string) => void;
};

const Context = createContext<ContextValue>({
  ...DEFAULT_HOME_ACCESSIBILITY,
  textScale: 1, zoomScale: 1, mapper: null, dark: false, panelOpen: false,
  setPanelOpen: () => undefined, update: () => undefined, reset: () => undefined, toggleDark: () => undefined, speak: () => undefined,
});

const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

export function HomeAccessibilityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<HomeAccessibilitySettings>(DEFAULT_HOME_ACCESSIBILITY);
  const [panelOpen, setPanelOpen] = useState(false);   // opened from the Home screen only (see AccessibilityLayer)
  const changedByUser = useRef(false);   // only the user's own changes are sent to the server, never defaults or values just loaded
  const loadedFor = useRef<unknown>(null);
  const serverApplied = useRef(false);    // once the account's own settings have arrived, an older copy from the phone must never replace them

  // 1. What this phone remembers, at once, so the screen is right from the first frame. A new install follows the phone's light/dark setting.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (serverApplied.current) return;
      if (value) { try { setSettings((cur) => (serverApplied.current ? cur : { ...DEFAULT_HOME_ACCESSIBILITY, ...JSON.parse(value) })); return; } catch { /* damaged: fall through */ } }
      if (Appearance.getColorScheme() === 'dark') setSettings((s) => (serverApplied.current ? s : { ...s, contrast: 'dark' }));
    }).catch(() => undefined);
  }, []);

  // 2. What this account saved on the server, whenever someone signs in (so a second phone or a reinstall gets the same look).
  useEffect(() => {
    if (!userId || loadedFor.current === userId) return;
    loadedFor.current = userId;
    api.getAccessibilityPreferences().then(({ settings: remote }) => {
      if (remote && Object.keys(remote).length) serverApplied.current = true;
      if (remote && Object.keys(remote).length) setSettings((cur) => (same({ ...cur, ...remote }, cur) ? cur : { ...DEFAULT_HOME_ACCESSIBILITY, ...cur, ...remote }));
    }).catch(() => undefined);
  }, [userId]);

  // 3. A change made on another device arrives here live.
  useEffect(() => {
    if (!userId) return undefined;
    realtime.start();
    return realtime.on('accessibility.update', (e: any) => {
      if (!e?.settings) return;
      changedByUser.current = false;      // do not echo it back to the server
      setSettings((cur) => (same({ ...cur, ...e.settings }, cur) ? cur : { ...DEFAULT_HOME_ACCESSIBILITY, ...cur, ...e.settings }));
    });
  }, [userId]);

  // Save: on the phone straight away, on the server shortly after the last tap.
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => undefined);
    if (!changedByUser.current || !userId) return undefined;
    const timer = setTimeout(() => {
      api.updateAccessibilityPreferences(settings as AccessibilitySettings).catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [settings, userId]);

  // The chosen language drives the translated text everywhere (and is kept in step when another device changes it).
  useEffect(() => { void setLang(settings.language as Lang); }, [settings.language]);

  // The phone's own dialogs, keyboard and pickers follow the same look.
  useEffect(() => {
    try { Appearance.setColorScheme(isDarkMode(settings.contrast) ? 'dark' : 'light'); } catch { /* older systems */ }
  }, [settings.contrast]);

  const mapper = useMemo(() => makeMapper(settings), [settings.contrast, settings.colorBlind, settings.grayscale, settings.saturation]);   // eslint-disable-line react-hooks/exhaustive-deps

  const speak = useCallback((text: string) => {
    if (!text) return;
    if (speakText(text, { language: settings.language, rate: 0.95 }) === 'unavailable') explainNoSpeech();
  }, [settings.language]);

  const value = useMemo<ContextValue>(() => ({
    ...settings,
    textScale: 1 + settings.fontSize * 0.1,
    zoomScale: 1 + settings.zoom * 0.1,
    mapper,
    dark: isDarkMode(settings.contrast),
    panelOpen,
    setPanelOpen,
    update: (key, val) => { changedByUser.current = true; setSettings((cur) => ({ ...cur, [key]: val })); },
    reset: () => { changedByUser.current = true; setSettings(DEFAULT_HOME_ACCESSIBILITY); },
    toggleDark: () => { changedByUser.current = true; setSettings((cur) => ({ ...cur, contrast: cur.contrast === 'dark' ? 'default' : 'dark' })); },
    speak,
  }), [settings, mapper, panelOpen, speak]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHomeAccessibility() {
  return useContext(Context);
}
