import React, { useEffect, useRef, useState } from 'react';
import { theme } from '../constants/theme';
import { useToast } from '../contexts/ToastContext';
import { useT } from '../i18n';
import { explainNoSpeech, silentSwitchHint, speak, stopSpeaking } from '../services/speech';
import { T } from './ui';
import { Ionicons, Pressable } from './themed';

const C = theme.COLORS;

/**
 * Reads text aloud with the phone's own voice (offline, free). For low-literacy and visually impaired users.
 * It never fails silently: if this app build has no speech module it says so, and the first time it starts it reminds the person
 * about the silent switch, the usual reason an iPhone stays quiet.
 */
export function ReadAloud({ text, label = 'Read aloud' }: { text: string; label?: string }) {
  const { lang } = useT();
  const { showToast } = useToast();
  const [speaking, setSpeaking] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; stopSpeaking(); }, []);

  const toggle = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    const done = () => { if (alive.current) setSpeaking(false); };
    const result = speak(text, {
      language: lang, rate: 0.9,
      onStart: () => silentSwitchHint((m) => showToast(m, 'info')),
      onDone: done,
      onError: () => { done(); showToast('Could not read this aloud.', 'error'); },
    });
    if (result === 'unavailable') { explainNoSpeech(true); return; }
    setSpeaking(true);
  };
  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={speaking ? 'Stop reading' : label} hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
      <Ionicons name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={22} color={C.primary} />
      <T v="label" color={C.primary}>{speaking ? 'Stop' : label}</T>
    </Pressable>
  );
}
