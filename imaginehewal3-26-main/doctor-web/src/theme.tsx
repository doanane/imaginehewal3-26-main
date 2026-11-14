import React, { useState } from 'react';
import { LucideIcon, Monitor, Moon, Sun } from 'lucide-react';

/** Light, dark, or follow the device. The choice is remembered in this browser and applied before the first paint of the app. */
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'hewal3.doctor.theme';

export function savedTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage blocked: the choice lasts until reload */ }
}

const OPTIONS: { v: Theme; label: string; icon: LucideIcon }[] = [
  { v: 'light', label: 'Light', icon: Sun },
  { v: 'system', label: 'Match device', icon: Monitor },
  { v: 'dark', label: 'Dark', icon: Moon },
];

export function ThemeToggle() {
  const [t, setT] = useState<Theme>(savedTheme());
  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {OPTIONS.map(o => (
        <button key={o.v} type="button" aria-pressed={t === o.v} aria-label={o.label} title={o.label} onClick={() => { setT(o.v); applyTheme(o.v); }}>
          <o.icon size={16} />
        </button>
      ))}
    </div>
  );
}
