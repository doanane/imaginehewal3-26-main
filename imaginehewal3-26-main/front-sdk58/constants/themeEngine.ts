/**
 * Colour engine for light/dark mode and the accessibility colour options.
 *
 * Every colour the app draws goes through `makeMapper(settings)`, so one setting changes every screen, including the many that
 * still use fixed hex values. The engine is pure (no React Native imports) so it can be tested on its own.
 *
 * A colour has a ROLE, because the right dark-mode colour depends on how it is used:
 *   bg      a surface (backgroundColor)           light surfaces become dark surfaces
 *   fg      text and icons (color, tintColor)     dark text becomes light text
 *   border  lines (borderColor)                   follow the surfaces
 * Saturated brand and status colours keep their identity: a teal button stays teal, only its text/background partners flip.
 */
export type Contrast = 'default' | 'dark' | 'high' | 'yellow' | 'sepia';
export type Role = 'bg' | 'fg' | 'border';
export type ColorBlind = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export type ThemeSettings = {
  contrast: Contrast | string;
  colorBlind: ColorBlind | string;
  grayscale: boolean;
  saturation: number;       // 0 = normal, 1 = reduced, 2 = low
};

type RGBA = { r: number; g: number; b: number; a: number };
type HSL = { h: number; s: number; l: number };

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', transparent: 'rgba(0,0,0,0)', red: '#ff0000', gray: '#808080', grey: '#808080' };

export function parseColor(input: string): RGBA | null {
  if (typeof input !== 'string') return null;
  let c = input.trim().toLowerCase();
  if (NAMED[c]) c = NAMED[c];
  let m = /^#([0-9a-f]{3,8})$/.exec(c);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;                                           // platform colours, names we do not know: left untouched
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

function toHsl({ r, g, b }: RGBA): HSL {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function fromHsl({ h, s, l }: HSL, a: number): RGBA {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a };
}

function format({ r, g, b, a }: RGBA): string {
  const R = Math.round(clamp(r, 0, 255)), G = Math.round(clamp(g, 0, 255)), B = Math.round(clamp(b, 0, 255));
  if (a >= 0.999) return '#' + [R, G, B].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `rgba(${R},${G},${B},${Math.round(a * 100) / 100})`;
}

/** WCAG relative luminance and contrast ratio, used by the tests. */
export function luminance(hex: string): number {
  const c = parseColor(hex); if (!c) return 0;
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ------------------------------------------------------------------ the fixed palette this app was designed with
// These exact surfaces get hand-picked dark values (elevation: page darkest, cards lighter). Everything else uses the rules below.
const DARK_EXACT: Record<string, { bg?: string; fg?: string; border?: string }> = {
  '#f4f7fa': { bg: '#0b1118' },                        // page background
  '#ffffff': { bg: '#151f2a', border: '#2a3744' },     // cards, inputs
  '#10202f': { bg: '#0e161e', fg: '#e8eef4' },         // dark card / primary text
  '#435468': { fg: '#b4c0cc' },                        // secondary text
  '#5a6b7e': { fg: '#9aa8b6' },                        // tertiary text
  '#5f6f82': { fg: '#94a3b2' },                        // muted text
  '#d5dde6': { border: '#2a3744', bg: '#2a3744' },
  '#e8edf2': { border: '#222e3a', bg: '#222e3a' },
  '#e3e9ef': { border: '#1e2933', bg: '#1e2933' },
};

function rolePick(role: Role, c: RGBA, l: HSL, mode: Contrast): RGBA | null {
  const neutral = l.s < 0.22;
  if (mode === 'dark') {
    const exact = DARK_EXACT[format({ ...c, a: 1 })];
    if (exact) {
      const hit = role === 'bg' ? exact.bg : role === 'border' ? exact.border ?? exact.bg : exact.fg;
      if (hit) { const p = parseColor(hit)!; return { ...p, a: c.a }; }
    }
    if (role === 'fg') {
      if (l.l < 0.55) return fromHsl({ h: l.h, s: clamp(l.s * 0.9, 0, 0.85), l: clamp(1 - l.l * 0.85 + 0.04, 0.62, 0.92) }, c.a);   // dark text and brand teal become light
      return null;
    }
    // surfaces and lines: light tints become dark tints of the same hue, mid and dark colours stay
    if (l.l > 0.62) return fromHsl({ h: l.h, s: clamp(l.s * 0.55, 0, 0.5), l: clamp(0.07 + (1 - l.l) * 0.5, 0.07, 0.24) }, c.a);
    return null;
  }
  if (mode === 'high' || mode === 'yellow') {
    const ink = mode === 'yellow' ? '#ffff00' : '#ffffff';
    if (role === 'fg') {
      if (l.l >= 0.78 && c.a >= 0.5) return null;                           // already light, fine on black
      if (neutral || l.l < 0.35) return { ...parseColor(ink)!, a: c.a };
      return fromHsl({ h: l.h, s: Math.max(l.s, 0.6), l: 0.72 }, c.a);       // chromatic text keeps its hue, made bright
    }
    if (role === 'border') return { ...parseColor(ink)!, a: Math.max(c.a, 0.9) };
    if (l.l > 0.45 || (neutral && l.l > 0.2)) return { r: 0, g: 0, b: 0, a: c.a };   // every light surface becomes black
    return null;                                                             // saturated buttons stay (their white text stays white)
  }
  if (mode === 'sepia') {
    if (role === 'fg') {
      if (l.l < 0.5 && neutral) return fromHsl({ h: 32, s: 0.55, l: clamp(0.13 + l.l * 0.3, 0.13, 0.3) }, c.a);   // dark brown ink
      return null;
    }
    if (l.l > 0.8) return fromHsl({ h: 40, s: 0.55, l: clamp(0.92 - (1 - l.l) * 0.5, 0.78, 0.9) }, c.a);            // cream paper
    return null;
  }
  return null;
}

// ------------------------------------------------------------------ colour-blind help (daltonisation) and saturation
const SIM: Record<string, number[][]> = {
  protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
};
function daltonize(c: RGBA, kind: string): RGBA {
  const m = SIM[kind]; if (!m) return c;
  const sim = [0, 1, 2].map((i) => m[i][0] * c.r + m[i][1] * c.g + m[i][2] * c.b);
  const err = [c.r - sim[0], c.g - sim[1], c.b - sim[2]];
  // move what the eye cannot tell apart into channels it can
  const r = c.r, g = c.g + 0.7 * err[0] + 1.0 * err[1], b = c.b + 0.7 * err[0] + 1.0 * err[2];
  return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: c.a };
}
function saturate(c: RGBA, grayscale: boolean, level: number): RGBA {
  if (!grayscale && level <= 0) return c;
  const l = toHsl(c);
  const factor = grayscale ? 0 : level === 1 ? 0.55 : 0.25;
  return fromHsl({ h: l.h, s: l.s * factor, l: l.l }, c.a);
}

export type Mapper = (color: string, role: Role) => string;

/** Returns null when the settings change no colour (default look): callers skip all work. */
export function makeMapper(s: ThemeSettings): Mapper | null {
  const mode = (['dark', 'high', 'yellow', 'sepia'].includes(String(s.contrast)) ? s.contrast : 'default') as Contrast;
  const cb = String(s.colorBlind || 'none');
  const filters = cb !== 'none' || s.grayscale || s.saturation > 0;
  if (mode === 'default' && !filters) return null;
  const cache = new Map<string, string>();
  return (color, role) => {
    if (typeof color !== 'string') return color;
    const key = role + color;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let out = color;
    const c = parseColor(color);
    if (c && c.a > 0) {
      let next: RGBA = c;
      if (mode !== 'default') next = rolePick(role, c, toHsl(c), mode) || c;
      if (cb !== 'none') next = daltonize(next, cb);
      if (s.grayscale || s.saturation > 0) next = saturate(next, s.grayscale, s.saturation);
      out = format(next);
    }
    cache.set(key, out);
    return out;
  };
}

export const isDarkMode = (contrast: string) => contrast === 'dark' || contrast === 'high' || contrast === 'yellow';

/** Colour for things that sit behind everything (navigator background, status bar). */
export function pageBackground(s: ThemeSettings): string {
  const m = makeMapper(s);
  return m ? m('#F4F7FA', 'bg') : '#F4F7FA';
}

export const COLOR_STYLE_KEYS: Record<string, Role> = {
  backgroundColor: 'bg',
  color: 'fg', tintColor: 'fg', textDecorationColor: 'fg', textShadowColor: 'fg',
  borderColor: 'border', borderTopColor: 'border', borderBottomColor: 'border', borderLeftColor: 'border', borderRightColor: 'border',
  borderStartColor: 'border', borderEndColor: 'border',
};

/** Maps the colours inside one style object. Returns the same object when nothing changed. */
export function mapStyleObject(style: Record<string, any>, map: Mapper): Record<string, any> {
  let out: Record<string, any> | null = null;
  for (const k in style) {
    const role = COLOR_STYLE_KEYS[k];
    if (!role) continue;
    const v = style[k];
    if (typeof v !== 'string') continue;
    const n = map(v, role);
    if (n !== v) { if (!out) out = { ...style }; out[k] = n; }
  }
  return out || style;
}
