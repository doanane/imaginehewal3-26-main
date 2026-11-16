/** Renders the real themed components under the real provider and checks that each setting does what its label says. */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

const mockHandlers: Record<string, (e: any) => void> = {};
const mockSpeak = jest.fn();
const mockUpdate = jest.fn((_s?: unknown) => Promise.resolve({ settings: {} }));
const mockGet = jest.fn(() => Promise.resolve({ settings: {} }));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { getAccessibilityPreferences: () => mockGet(), updateAccessibilityPreferences: (s: any) => mockUpdate(s), invalidateApiCache: jest.fn() },
}));
jest.mock('../../services/realtime', () => ({ realtime: { start: jest.fn(), on: (t: string, h: any) => { mockHandlers[t] = h; return () => { delete mockHandlers[t]; }; } } }));
jest.mock('../../services/native', () => ({ getSpeech: () => ({ speak: mockSpeak, stop: jest.fn() }) }));

import { AccessibilityLayer, HomeAccessibilityProvider, useHomeAccessibility } from '../HomeAccessibility';
import { Image, LinearGradient, Pressable, Text, TextInput, View, textAt } from '../themed';

const nodeBox = { current: [10, 100, 200, 20] };
let api: ReturnType<typeof useHomeAccessibility>;
function Probe() { api = useHomeAccessibility(); return null; }

async function mount(tree: React.ReactElement, withLayer = false): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <HomeAccessibilityProvider>
        <Probe />
        {withLayer ? <AccessibilityLayer>{tree}</AccessibilityLayer> : tree}
      </HomeAccessibilityProvider>,
      { createNodeMock: () => ({ measureInWindow: (cb: any) => cb(...(nodeBox.current as [number, number, number, number])) }) },   // a test has no layout, so every node reports this box
    );
  });
  return r;
}
const set = async (key: any, value: any) => { await act(async () => { api.update(key, value); }); };
const flat = (style: any): any => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style || {});
const byTestId = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];

beforeEach(async () => { await AsyncStorage.clear(); jest.useFakeTimers(); mockSpeak.mockClear(); mockUpdate.mockClear(); mockGet.mockClear(); nodeBox.current = [10, 100, 200, 20]; });
afterEach(() => { jest.useRealTimers(); });

test('default look draws the colours exactly as written', async () => {
  const r = await mount(<View testID="box" style={{ backgroundColor: '#FFFFFF', borderColor: '#D5DDE6' }} />);
  expect(flat(byTestId(r, 'box').props.style)).toMatchObject({ backgroundColor: '#FFFFFF', borderColor: '#D5DDE6' });
});

test('dark mode recolours surfaces, text and lines on every themed part at once', async () => {
  const r = await mount(<View testID="box" style={[{ backgroundColor: '#FFFFFF', borderColor: '#D5DDE6' }, { padding: 8 }]}><Text testID="t" style={{ color: '#10202F' }}>Hello</Text></View>);
  await set('contrast', 'dark');
  expect(flat(byTestId(r, 'box').props.style)).toMatchObject({ backgroundColor: '#151f2a', borderColor: '#2a3744', padding: 8 });
  expect(flat(byTestId(r, 't').props.style).color).toBe('#e8eef4');
  await set('contrast', 'default');                                   // and back
  expect(flat(byTestId(r, 'box').props.style).backgroundColor).toBe('#FFFFFF');
});

test('the light/dark switch toggles dark and back', async () => {
  const r = await mount(<View testID="box" style={{ backgroundColor: '#F4F7FA' }} />);
  await act(async () => { api.toggleDark(); });
  expect(api.contrast).toBe('dark'); expect(api.dark).toBe(true);
  expect(flat(byTestId(r, 'box').props.style).backgroundColor).toBe('#0b1118');
  await act(async () => { api.toggleDark(); });
  expect(api.contrast).toBe('default');
});

test('high contrast, yellow and sepia', async () => {
  const r = await mount(<View testID="box" style={{ backgroundColor: '#FFFFFF' }}><Text testID="t" style={{ color: '#10202F' }}>x</Text></View>);
  await set('contrast', 'high');
  expect(flat(byTestId(r, 'box').props.style).backgroundColor).toBe('#000000'); expect(flat(byTestId(r, 't').props.style).color).toBe('#ffffff');
  await set('contrast', 'yellow'); expect(flat(byTestId(r, 't').props.style).color).toBe('#ffff00');
  await set('contrast', 'sepia'); expect(flat(byTestId(r, 'box').props.style).backgroundColor).not.toBe('#FFFFFF');
});

test('grayscale and colour-blind help change colours', async () => {
  const r = await mount(<Text testID="t" style={{ color: '#B42318' }}>x</Text>);
  await set('grayscale', true);
  const c = flat(byTestId(r, 't').props.style).color as string;
  expect(c.slice(1, 3)).toBe(c.slice(3, 5));
  await set('grayscale', false); await set('colorBlind', 'deuteranopia');
  expect(flat(byTestId(r, 't').props.style).color).not.toBe('#B42318');
});

test('text size scales every Text and TextInput, including ones with no size of their own', async () => {
  const r = await mount(<View><Text testID="a" style={{ fontSize: 16, lineHeight: 24 }}>a</Text><Text testID="b">b</Text><TextInput testID="c" style={{ fontSize: 20 }} /></View>);
  await set('fontSize', 2);
  expect(flat(byTestId(r, 'a').props.style)).toMatchObject({ fontSize: 16 * 1.2, lineHeight: 24 * 1.2 });
  expect(flat(byTestId(r, 'b').props.style).fontSize).toBeCloseTo(14 * 1.2);
  expect(flat(byTestId(r, 'c').props.style).fontSize).toBeCloseTo(24);
  await set('fontSize', 0);
  expect(flat(byTestId(r, 'a').props.style).fontSize).toBe(16);
});

test('bold text', async () => {
  const r = await mount(<Text testID="a" style={{ fontWeight: '400' }}>a</Text>);
  await set('boldText', true);
  expect(flat(byTestId(r, 'a').props.style).fontWeight).toBe('700');
});

test('underline and highlight apply to links only', async () => {
  const r = await mount(<View><Text testID="link" onPress={() => {}}>go</Text><Text testID="plain">hi</Text></View>);
  await set('underlineLinks', true);
  expect(flat(byTestId(r, 'link').props.style).textDecorationLine).toBe('underline');
  expect(flat(byTestId(r, 'plain').props.style).textDecorationLine).toBeUndefined();
  await set('underlineLinks', false); await set('highlightLinks', true);
  expect(flat(byTestId(r, 'link').props.style)).toMatchObject({ backgroundColor: '#FFEB3B', color: '#000000' });
});

test('hide images replaces photos with plain blocks', async () => {
  const r = await mount(<Image testID="img" source={{ uri: 'https://x/y.png' }} style={{ width: 40, height: 40 }} />);
  const drawnImages = () => r.root.findAll((n) => String(n.type) === 'Image').length;
  expect(drawnImages()).toBe(1);
  await set('hideImages', true);
  expect(drawnImages()).toBe(0);
  await set('hideImages', false);
  expect(drawnImages()).toBe(1);
});

test('language: greetings and listed words translate, other text is untouched', async () => {
  const r = await mount(<View><Text testID="g">Good morning, Kofi</Text><Text testID="s">Steps</Text><Text testID="o">Blood pressure log</Text></View>);
  await set('language', 'tw');
  expect(byTestId(r, 'g').props.children).toBe('Mema wo akye, Kofi');
  expect(byTestId(r, 's').props.children).toBe('Anammɔn');
  expect(byTestId(r, 'o').props.children).toBe('Blood pressure log');
  await set('language', 'en'); expect(byTestId(r, 's').props.children).toBe('Steps');
});

test('choosing French or Arabic changes the whole screen: sentences, counted text, placeholders and pop-ups, and English comes back', async () => {
  const { Alert } = require('react-native');
  const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  require('../../i18n/alertPatch');                                              // the app installs this once at start
  const r = await mount(<View>
    <Text testID="a">Sign in</Text>
    <Text testID="b">{3} days left</Text>
    <Text testID="c">Good morning, Ama</Text>
    <TextInput testID="t" placeholder="Enter your email" />
  </View>);
  await set('language', 'fr');
  expect(byTestId(r, 'a').props.children).toBe('Se connecter');
  expect(byTestId(r, 'b').props.children).toBe('3 jours restants');            // React hands Text the pieces ['3', ' days left']; they are joined first
  expect(byTestId(r, 'c').props.children).toBe('Bonjour, Ama');
  expect(byTestId(r, 't').props.placeholder).toBe('Saisissez votre e-mail');
  await act(async () => { Alert.alert('Delete post', 'Delete your post?', [{ text: 'Cancel' }, { text: 'Delete' }]); });
  const last = spy.mock.calls[spy.mock.calls.length - 1] as any[];
  expect(last[0]).toBe('Supprimer la publication');
  expect(last[2].map((b: any) => b.text)).toEqual(['Annuler', 'Supprimer']);
  await set('language', 'ar');
  expect(byTestId(r, 'a').props.children).toBe('تسجيل الدخول');
  expect(byTestId(r, 'b').props.children).toBe('متبقٍ 3 أيام');
  await set('language', 'en');
  expect(byTestId(r, 'a').props.children).toBe('Sign in');
  expect(byTestId(r, 't').props.placeholder).toBe('Enter your email');
  spy.mockRestore();
});

test('large tap areas widen every button', async () => {
  const r = await mount(<Pressable testID="p" onPress={() => {}}><Text>ok</Text></Pressable>);
  expect(byTestId(r, 'p').props.hitSlop).toBeUndefined();
  await set('keyboardNavigation', true);
  expect(byTestId(r, 'p').props.hitSlop).toMatchObject({ top: 12, bottom: 12, left: 12, right: 12 });
});

test('a change is saved on the phone at once and sent to the account shortly after, once', async () => {
  await mount(<View />);
  await set('contrast', 'dark'); await set('fontSize', 1);
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(500); });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ contrast: 'dark', fontSize: 1 }));
});

test('nothing is sent to the server just for opening the app (defaults and loaded values are never written back)', async () => {
  mockGet.mockImplementationOnce(() => Promise.resolve({ settings: { contrast: 'sepia', fontSize: 3 } }));
  await mount(<View />);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(api.contrast).toBe('sepia'); expect(api.fontSize).toBe(3);      // the account's saved look is applied
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('a change made on another device arrives live and is not echoed back', async () => {
  const r = await mount(<View testID="box" style={{ backgroundColor: '#FFFFFF' }} />);
  expect(mockHandlers['accessibility.update']).toBeDefined();
  await act(async () => { mockHandlers['accessibility.update']({ settings: { contrast: 'dark', fontSize: 2 } }); });
  expect(api.contrast).toBe('dark');
  expect(flat(byTestId(r, 'box').props.style).backgroundColor).toBe('#151f2a');
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('read aloud: the text under a point is found and spoken', async () => {
  await mount(<View><Text>Take your tablet at 8 pm</Text></View>);
  await set('screenReader', true);
  await expect(textAt(50, 110)).resolves.toBe('Take your tablet at 8 pm');
  await expect(textAt(500, 500)).resolves.toBeNull();
  await act(async () => { api.speak('hello'); });
  expect(mockSpeak).toHaveBeenCalledWith('hello', expect.objectContaining({ language: 'en-GB' }));
});

test('page zoom scales the whole app layout', async () => {
  const r = await mount(<View testID="inside" />, true);
  expect(r.root.findAll((n) => n.props.style && flat(n.props.style).transform).length).toBe(0);
  await set('zoom', 2);
  const zoomed = r.root.findAll((n) => typeof n.type === 'string' && flat(n.props.style).transform);
  expect(zoomed.length).toBeGreaterThan(0);
  expect(flat(zoomed[0].props.style).transform[0].scale).toBeCloseTo(1.2);
});

test('dimmer and reading guide overlays appear only when on', async () => {
  const r = await mount(<View />, true);
  const overlays = () => r.root.findAll((n) => typeof n.type === 'string' && n.props.pointerEvents === 'none').length;
  const before = overlays();
  await set('dimmer', 2); expect(overlays()).toBe(before + 1);
  await set('readingGuide', true); expect(overlays()).toBe(before + 2);
  await set('dimmer', 0); await set('readingGuide', false); expect(overlays()).toBe(before);
});

test('the accessibility button exists on the Home screen only', async () => {
  const label = 'Open accessibility settings';
  const has = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').length > 0;
  (global as any).__segments = ['(patient)', '(tabs)', 'today'];
  expect(has(await mount(<View />, true))).toBe(true);
  for (const where of [['(patient)', '(tabs)', 'insights'], ['(patient)', 'devices'], ['(auth)', 'login'], ['(caregiver)', 'dashboard']]) {
    (global as any).__segments = where;
    expect(has(await mount(<View />, true))).toBe(false);
  }
  (global as any).__segments = undefined;
});

test('settings chosen on Home still apply on every other screen', async () => {
  (global as any).__segments = ['(patient)', 'devices'];
  const r = await mount(<View testID="box" style={{ backgroundColor: '#FFFFFF' }} />, true);
  await set('contrast', 'dark');
  expect(flat(byTestId(r, 'box').props.style).backgroundColor).toBe('#151f2a');
  (global as any).__segments = undefined;
});

test('the panel opens from the button and its Dark option really switches to dark', async () => {
  const r = await mount(<View testID="box" style={{ backgroundColor: '#FFFFFF' }} />, true);
  const press = (label: string) => r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  await act(async () => { press('Open accessibility settings').props.onPress(); });
  expect(api.panelOpen).toBe(true);
  await act(async () => { press('Dark').props.onPress(); });
  expect(api.contrast).toBe('dark');
  expect(flat(byTestId(r, 'box').props.style).backgroundColor).toBe('#151f2a');
  await act(async () => { press('Reset everything to default'); });
});


test('a shadow with no solid background gets one (no more "cannot calculate shadow efficiently"), nothing else changes', async () => {
  const shadow = { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, borderRadius: 16 };
  const r = await mount(<View>
    <View testID="bare" style={shadow} />
    <View testID="array" style={[{ padding: 4 }, shadow]} />
    <View testID="has" style={{ ...shadow, backgroundColor: '#ABCDEF' }} />
    <View testID="plain" style={{ padding: 4 }} />
    <LinearGradient testID="grad" colors={['#0B6E6E', '#0A7C99']} style={shadow} />
    <LinearGradient testID="gradflat" colors={['#0B6E6E', '#0A7C99']} style={{ borderRadius: 8 }} />
  </View>);
  const bg = (id: string) => flat(byTestId(r, id).props.style).backgroundColor;
  expect(bg('bare')).toBe('#FFFFFF'); expect(bg('array')).toBe('#FFFFFF');
  expect(bg('has')).toBe('#ABCDEF');                       // an existing colour is never replaced
  expect(bg('plain')).toBeUndefined();                      // no shadow, no change
  expect(bg('grad')).toBe('#0B6E6E');                       // a gradient uses its first colour as the solid base
  expect(bg('gradflat')).toBeUndefined();
  await set('contrast', 'dark');
  expect(bg('bare')).toBe('#151f2a');                       // and it still follows dark mode
});
