// Run with: node constants/themeEngine.test.mts   (Node 22.18+ strips the types itself; no test framework needed)
import assert from 'node:assert/strict';
import { contrastRatio, makeMapper, mapStyleObject, parseColor, isDarkMode, pageBackground } from './themeEngine.ts';

const base = { contrast: 'default', colorBlind: 'none', grayscale: false, saturation: 0 };
let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; console.log('PASS', name); } catch (e: any) { console.log('FAIL', name, '\n  ', e.message); process.exitCode = 1; } };

// the palette the app ships with (constants/theme.ts)
const P = {
  background: '#F4F7FA', card: '#FFFFFF', textPrimary: '#10202F', textSecondary: '#435468', textTertiary: '#5A6B7E', textMuted: '#5F6F82',
  primary: '#0B6E6E', primaryDark: '#095858', primarySoft: '#E5F2F1', success: '#17724A', successLight: '#E4F4EC',
  warning: '#8A5A00', warningLight: '#FFF3D6', danger: '#B42318', dangerLight: '#FDECEA', info: '#1D4ED8', infoLight: '#E8EEFD',
  border: '#D5DDE6',
};

t('default look maps nothing', () => assert.equal(makeMapper(base), null));
t('parses hex, short hex, rgb, rgba, names', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('rgba(0,0,0,0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.equal(parseColor('PlatformColor'), null);
});

const dark = makeMapper({ ...base, contrast: 'dark' })!;
t('dark: page darker than cards, both dark', () => {
  const page = dark(P.background, 'bg'), card = dark(P.card, 'bg');
  assert.equal(page, '#0b1118'); assert.equal(card, '#151f2a');
});
t('dark: text colours readable on cards (AA 4.5:1)', () => {
  const card = dark(P.card, 'bg');
  for (const k of ['textPrimary', 'textSecondary', 'textTertiary', 'textMuted'] as const) {
    const r = contrastRatio(dark((P as any)[k], 'fg'), card);
    assert.ok(r >= 4.5, `${k} on card is ${r.toFixed(2)}`);
  }
});
t('dark: brand teal and status text readable on the page and on cards', () => {
  for (const k of ['primary', 'primaryDark', 'success', 'warning', 'danger', 'info'] as const) {
    for (const surface of [dark(P.background, 'bg'), dark(P.card, 'bg')]) {
      const r = contrastRatio(dark((P as any)[k], 'fg'), surface);
      assert.ok(r >= 4.5, `${k} text on ${surface} is ${r.toFixed(2)}`);
    }
  }
});
t('dark: status text readable on its own tinted chip', () => {
  const pairs: [string, string][] = [['success', 'successLight'], ['warning', 'warningLight'], ['danger', 'dangerLight'], ['info', 'infoLight'], ['primaryDark', 'primarySoft']];
  for (const [fg, bg] of pairs) {
    const r = contrastRatio(dark((P as any)[fg], 'fg'), dark((P as any)[bg], 'bg'));
    assert.ok(r >= 4.5, `${fg} on ${bg} is ${r.toFixed(2)}`);
  }
});
t('dark: tinted chips become dark tints of the same colour, not grey', () => {
  const c = parseColor(dark(P.dangerLight, 'bg'))!;
  assert.ok(c.r > c.g && c.r > c.b, 'red tint kept');
  assert.ok(c.r < 90, 'dark');
});
t('dark: white text on a teal button stays white and the button keeps its colour', () => {
  assert.equal(dark('#FFFFFF', 'fg'), '#ffffff');
  assert.equal(dark(P.primary, 'bg'), '#0b6e6e');
  assert.ok(contrastRatio('#ffffff', dark(P.primary, 'bg')) >= 4.5);
});
t('dark: translucent colours keep their alpha, black overlays stay black', () => {
  assert.match(dark('rgba(255,255,255,0.8)', 'bg'), /^rgba\(\d+,\d+,\d+,0\.8\)$/);
  assert.equal(dark('rgba(0,0,0,0.5)', 'bg'), 'rgba(0,0,0,0.5)');
  assert.equal(dark('transparent', 'bg'), 'transparent');
});
t('dark: unknown platform colours pass through untouched', () => assert.equal(dark('PlatformColor' as any, 'bg'), 'PlatformColor'));

const high = makeMapper({ ...base, contrast: 'high' })!;
t('high contrast: black surfaces, white text (21:1), white lines', () => {
  assert.equal(high(P.card, 'bg'), '#000000'); assert.equal(high(P.background, 'bg'), '#000000');
  assert.equal(high(P.textPrimary, 'fg'), '#ffffff'); assert.equal(high(P.border, 'border'), '#ffffff');
  assert.ok(contrastRatio(high(P.textSecondary, 'fg'), '#000000') >= 7);
});
t('high contrast: status text keeps its hue and is at least AAA on black', () => {
  for (const k of ['danger', 'success', 'warning', 'info', 'primary'] as const) {
    const r = contrastRatio(high((P as any)[k], 'fg'), '#000000');
    assert.ok(r >= 7, `${k} is ${r.toFixed(2)}`);
  }
});
const yellow = makeMapper({ ...base, contrast: 'yellow' })!;
t('yellow on black', () => {
  assert.equal(yellow(P.textPrimary, 'fg'), '#ffff00'); assert.equal(yellow(P.card, 'bg'), '#000000');
  assert.ok(contrastRatio('#ffff00', '#000000') > 19);
});
const sepia = makeMapper({ ...base, contrast: 'sepia' })!;
t('sepia: warm paper, brown ink, readable', () => {
  const paper = sepia(P.card, 'bg'), page = sepia(P.background, 'bg'), ink = sepia(P.textPrimary, 'fg');
  assert.notEqual(paper, '#ffffff'); assert.ok(contrastRatio(ink, paper) >= 7, 'primary text'); assert.ok(contrastRatio(sepia(P.textSecondary, 'fg'), page) >= 4.5, 'secondary text');
});

t('grayscale removes all colour', () => {
  const g = makeMapper({ ...base, grayscale: true })!;
  for (const k of Object.keys(P)) { const c = parseColor(g((P as any)[k], 'bg'))!; assert.ok(Math.abs(c.r - c.g) <= 1 && Math.abs(c.g - c.b) <= 1, k); }
});
t('saturation levels reduce colour progressively', () => {
  const sat = (c: string) => { const p = parseColor(c)!; return Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b); };
  const one = sat(makeMapper({ ...base, saturation: 1 })!('#B42318', 'fg')), two = sat(makeMapper({ ...base, saturation: 2 })!('#B42318', 'fg'));
  assert.ok(sat('#B42318') > one && one > two, `${sat('#B42318')} ${one} ${two}`);
});
t('colour-blind modes change red and green and leave greys alone', () => {
  for (const kind of ['protanopia', 'deuteranopia', 'tritanopia']) {
    const m = makeMapper({ ...base, colorBlind: kind })!;
    assert.notEqual(m('#B42318', 'fg'), '#b42318', kind + ' red'); assert.notEqual(m('#17724A', 'fg'), '#17724a', kind + ' green');
    const grey = parseColor(m('#808080', 'bg'))!; assert.ok(Math.abs(grey.r - grey.g) < 3 && Math.abs(grey.g - grey.b) < 3, kind + ' grey');
  }
});
t('filters stack on a mode', () => {
  const m = makeMapper({ ...base, contrast: 'dark', grayscale: true })!;
  const c = parseColor(m(P.dangerLight, 'bg'))!; assert.ok(Math.abs(c.r - c.g) <= 1);
});
t('style objects: only colour keys change, same object when nothing changes', () => {
  const style = { backgroundColor: '#FFFFFF', color: '#10202F', padding: 8, borderColor: '#D5DDE6', flex: 1 };
  const out = mapStyleObject(style, dark);
  assert.equal(out.padding, 8); assert.equal(out.flex, 1);
  assert.equal(out.backgroundColor, '#151f2a'); assert.equal(out.color, '#e8eef4'); assert.equal(out.borderColor, '#2a3744');
  const same = { padding: 4 }; assert.equal(mapStyleObject(same, dark), same);
});
t('dark mode helper and page background', () => {
  assert.ok(isDarkMode('dark') && isDarkMode('high') && !isDarkMode('default') && !isDarkMode('sepia'));
  assert.equal(pageBackground({ ...base, contrast: 'dark' }), '#0b1118'); assert.equal(pageBackground(base), '#F4F7FA');
});
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
