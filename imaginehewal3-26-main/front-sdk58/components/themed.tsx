/**
 * Drop-in replacements for the React Native parts the screens use (View, Text, TextInput, Image, icons, gradients...).
 * They look exactly the same until the user changes a setting; then every screen follows, because they all read the same settings:
 *   dark / high contrast / yellow / sepia, colour-blind help, grayscale, saturation, text size, bold text, underlined or highlighted
 *   links, larger tap areas, hidden images, the chosen language, and "read aloud on long press".
 * Screens import these from here instead of from 'react-native', so no screen needs its own dark-mode code.
 */
import { Ionicons as RNIonicons, MaterialCommunityIcons as RNMCI, MaterialIcons as RNMI } from '@expo/vector-icons';
import { LinearGradient as RNLinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator as RNActivityIndicator, FlatList as RNFlatList, Image as RNImage, ImageBackground as RNImageBackground,
  Keyboard, KeyboardAvoidingView as RNKeyboardAvoidingView, Platform, Pressable as RNPressable, RefreshControl as RNRefreshControl,
  ScrollView as RNScrollView, StatusBar as RNStatusBar, StyleSheet, Switch as RNSwitch, Text as RNText,
  TextInput as RNTextInput, TouchableOpacity as RNTouchableOpacity, View as RNView,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import * as RNSvg from 'react-native-svg';
import { mapStyleObject, Mapper } from '../constants/themeEngine';
import { translateChildren, translateText } from '../i18n/translate';
import { useHomeAccessibility } from './homeAccessibilityContext';

type A = ReturnType<typeof useHomeAccessibility>;

// ------------------------------------------------------------------ helpers
function mapStyle(style: any, map: Mapper | null): any {
  if (!map || !style) return style;
  if (Array.isArray(style)) {
    let changed = false;
    const out = style.map((s) => { const n = mapStyle(s, map); if (n !== s) changed = true; return n; });
    return changed ? out : style;
  }
  if (typeof style === 'object') {
    if ('viewDescriptors' in style || 'initial' in style) return style;      // animated styles belong to the animation library
    return mapStyleObject(style, map);
  }
  return style;
}
/**
 * A view with a shadow but no solid background cannot have its shadow drawn efficiently (iOS warns "cannot calculate shadow
 * efficiently"). Almost every such view is a card, so give it a solid background; the light colour is mapped for dark mode like any other.
 */
function shadowNoBg(style: any): boolean {
  let shadow = false, bg = false;
  const walk = (x: any) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) walk(x[i]); return; }
    if (x.shadowOpacity > 0 || x.elevation > 0) shadow = true;
    if (x.backgroundColor) bg = true;
  };
  walk(style);
  return shadow && !bg;
}
const SOLID = { backgroundColor: '#FFFFFF' };

const mapColor = (c: any, map: Mapper | null, role: 'fg' | 'bg' | 'border' = 'fg') => (map && typeof c === 'string' ? map(c, role) : c);

/** Hook for custom components that build their own style objects (for example animated wrappers). */
export function useThemedStyle<T>(style: T): T {
  const { mapper } = useHomeAccessibility();
  return mapStyle(shadowNoBg(style) ? ([style, SOLID] as any) : style, mapper);
}
export function useColorMapper() {
  const { mapper } = useHomeAccessibility();
  return useCallback((c: string, role: 'fg' | 'bg' | 'border' = 'fg') => mapColor(c, mapper, role), [mapper]);
}

function mapPressableStyle(style: any, map: Mapper | null) {
  if (!map) return style;
  return typeof style === 'function' ? (s: any) => mapStyle(style(s), map) : mapStyle(style, map);
}

// ------------------------------------------------------------------ containers
function themedContainer<P extends object>(Base: any, styleProps: string[] = ['style']): React.ComponentType<P> {
  const W = forwardRef<any, any>((props, ref) => {
    const a = useHomeAccessibility();
    const solid = props.style && shadowNoBg(props.style);
    if (!a.mapper && !solid) return <Base {...props} ref={ref} />;
    const next: any = { ...props };
    if (solid) next.style = [props.style, SOLID];
    for (const k of styleProps) if (k in next) next[k] = mapStyle(next[k], a.mapper);
    return <Base {...next} ref={ref} />;
  });
  W.displayName = `Themed(${Base.displayName || Base.name || 'Component'})`;
  return W as unknown as React.ComponentType<P>;
}

export const View = themedContainer(RNView) as unknown as typeof RNView;
export const SafeAreaView = themedContainer(RNSafeAreaView) as unknown as typeof RNSafeAreaView;
export const KeyboardAvoidingView = themedContainer(RNKeyboardAvoidingView) as unknown as typeof RNKeyboardAvoidingView;

function themedScroll<T>(Base: any, scrollsToInput = false) {
  const W = forwardRef<any, any>((props, ref) => {
    const a = useHomeAccessibility();
    const next: any = { ...props };
    // Android: when the keyboard opens, scroll so the box being typed in stays in view, above the keyboard (the app is padded for the keyboard in KeyboardInset)
    const inner = useRef<any>(null);
    const offset = useRef(0);
    useEffect(() => {
      if (!scrollsToInput || Platform.OS !== 'android') return;
      const sub = Keyboard.addListener('keyboardDidShow', (e) => {
        const input = (RNTextInput as any).State?.currentlyFocusedInput?.();
        if (!input?.measureInWindow || !inner.current?.measureInWindow) return;
        setTimeout(() => {
          input.measureInWindow((_ix: number, iy: number, _iw: number, ih: number) => {
            inner.current?.measureInWindow?.((_sx: number, sy: number, _sw: number, sh: number) => {
              const bottom = Math.min(sy + sh, e.endCoordinates.screenY) - 16;
              const top = sy + 8;
              if (iy + ih > bottom) inner.current?.scrollTo?.({ y: offset.current + (iy + ih - bottom), animated: true });
              else if (iy < top) inner.current?.scrollTo?.({ y: Math.max(0, offset.current - (top - iy)), animated: true });
            });
          });
        }, 200);                                                   // let the layout settle above the keyboard first
      });
      return () => sub.remove();
    }, []);
    if (scrollsToInput && Platform.OS === 'android') {
      const userScroll = props.onScroll;
      next.onScroll = (ev: any) => { offset.current = ev.nativeEvent.contentOffset.y; userScroll?.(ev); };
      next.scrollEventThrottle = props.scrollEventThrottle ?? 16;
    }
    const setRef = (node: any) => { inner.current = node; if (typeof ref === 'function') ref(node); else if (ref) (ref as any).current = node; };
    if (a.mapper) {
      if ('style' in next) next.style = mapStyle(next.style, a.mapper);
      if ('contentContainerStyle' in next) next.contentContainerStyle = mapStyle(next.contentContainerStyle, a.mapper);
      if ('columnWrapperStyle' in next) next.columnWrapperStyle = mapStyle(next.columnWrapperStyle, a.mapper);
    }
    if (a.dark && next.indicatorStyle === undefined) next.indicatorStyle = 'white';
    return <Base {...next} ref={setRef} />;
  });
  W.displayName = `Themed(${Base.displayName || Base.name || 'Scroll'})`;
  return W as unknown as T;
}
export const ScrollView = themedScroll<typeof RNScrollView>(RNScrollView, true);
export const FlatList = themedScroll<typeof RNFlatList>(RNFlatList);

// ------------------------------------------------------------------ touchables
function themedTouchable<P extends object>(Base: any): React.ComponentType<P> {
  const W = forwardRef<any, any>((props, ref) => {
    const a = useHomeAccessibility();
    if (!a.mapper && !a.keyboardNavigation) return <Base {...props} ref={ref} />;
    const next: any = { ...props };
    if (a.mapper && 'style' in next) next.style = mapPressableStyle(next.style, a.mapper);
    if (a.keyboardNavigation) {          // "Large tap areas": a generous invisible margin around every button
      const slop = typeof next.hitSlop === 'object' && next.hitSlop ? next.hitSlop : {};
      next.hitSlop = { top: 12, bottom: 12, left: 12, right: 12, ...slop };
      if (next.focusable === undefined) next.focusable = true;
    }
    return <Base {...next} ref={ref} />;
  });
  W.displayName = `Themed(${Base.displayName || Base.name || 'Touchable'})`;
  return W as unknown as React.ComponentType<P>;
}
export const Pressable = themedTouchable(RNPressable) as unknown as typeof RNPressable;
export const TouchableOpacity = themedTouchable(RNTouchableOpacity) as unknown as typeof RNTouchableOpacity;

// ------------------------------------------------------------------ read aloud (long press on any text)
let seq = 0;
const readable = new Map<number, { ref: React.MutableRefObject<any>; text: string }>();

/** Finds the text under a point on screen (the newest, smallest one that contains it) and returns it. */
export function textAt(x: number, y: number): Promise<string | null> {
  const entries = Array.from(readable.entries()).sort((p, q) => q[0] - p[0]).slice(0, 400);
  return new Promise((resolve) => {
    let pending = entries.length, best: { id: number; area: number; text: string } | null = null;
    if (!pending) return resolve(null);
    const done = () => { if (--pending === 0) resolve(best ? best.text : null); };
    for (const [id, e] of entries) {
      const node = e.ref.current;
      if (!node || typeof node.measureInWindow !== 'function') { done(); continue; }
      node.measureInWindow((px: number, py: number, w: number, h: number) => {
        if (x >= px && x <= px + w && y >= py && y <= py + h && w > 0 && h > 0) {
          const area = w * h;
          if (!best || id > best.id + 50 || (Math.abs(id - best.id) <= 50 && area < best.area)) best = { id, area, text: e.text };
        }
        done();
      });
    }
  });
}

function plainText(children: any): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');
  return '';
}

// ------------------------------------------------------------------ text
function textChildren(children: any, lang: string): any {
  return translateChildren(children, lang);          // whole sentences first, so "{count} days left" translates as one phrase
}

function buildTextProps(props: any, a: A, isInput: boolean) {
  const needs = a.mapper || a.textScale !== 1 || a.boldText;
  let style = props.style;
  if (needs) {
    style = mapStyle(style, a.mapper);
    const flat: any = StyleSheet.flatten(style) || {};
    const extra: any = {};
    if (a.textScale !== 1) {
      extra.fontSize = (flat.fontSize ?? 14) * a.textScale;
      if (flat.lineHeight) extra.lineHeight = flat.lineHeight * a.textScale;
    }
    if (a.boldText && !(Number(flat.fontWeight) >= 600 || flat.fontWeight === 'bold')) extra.fontWeight = '700';
    if (Object.keys(extra).length) style = [style, extra];
  }
  const next: any = { ...props, style };
  if (isInput) {
    if (a.mapper && 'placeholderTextColor' in props) next.placeholderTextColor = mapColor(props.placeholderTextColor, a.mapper);
    if (a.mapper && 'selectionColor' in props) next.selectionColor = mapColor(props.selectionColor, a.mapper);
    if (a.mapper && 'cursorColor' in props) next.cursorColor = mapColor(props.cursorColor, a.mapper);
    if (a.dark && next.keyboardAppearance === undefined) next.keyboardAppearance = 'dark';
  }
  return next;
}

const TextBase: any = forwardRef<any, any>((props, ref) => {
  const a = useHomeAccessibility();
  const inner = useRef<any>(null);
  const setRef = useCallback((node: any) => {
    inner.current = node;
    if (typeof ref === 'function') ref(node); else if (ref) (ref as any).current = node;
  }, [ref]);
  const text = a.screenReader ? plainText(props.children) : '';
  useEffect(() => {
    if (!text) return undefined;
    const id = ++seq;
    readable.set(id, { ref: inner, text });
    return () => { readable.delete(id); };
  }, [text]);

  const fast = !a.mapper && a.textScale === 1 && !a.boldText && !a.underlineLinks && !a.highlightLinks && a.language === 'en';
  if (fast) return <RNText {...props} ref={setRef} />;
  const next = buildTextProps(props, a, false);
  next.children = textChildren(props.children, a.language);
  const isLink = typeof props.onPress === 'function' || props.accessibilityRole === 'link';
  if (isLink && (a.underlineLinks || a.highlightLinks)) {
    const deco: any = {};
    if (a.underlineLinks) deco.textDecorationLine = 'underline';
    if (a.highlightLinks) { deco.backgroundColor = '#FFEB3B'; deco.color = '#000000'; }
    next.style = [next.style, deco];
  }
  return <RNText {...next} ref={setRef} />;
});
TextBase.displayName = 'ThemedText';
export const Text = TextBase as unknown as typeof RNText;

const InputBase: any = forwardRef<any, any>((props, ref) => {
  const a = useHomeAccessibility();
  const next = buildTextProps(props, a, true);
  if (a.language !== 'en' && typeof next.placeholder === 'string') next.placeholder = translateText(next.placeholder, a.language);
  return <RNTextInput {...next} ref={ref} />;
});
InputBase.displayName = 'ThemedTextInput';
export const TextInput = InputBase as unknown as typeof RNTextInput;

// ------------------------------------------------------------------ images
const ImageBase: any = forwardRef<any, any>((props, ref) => {
  const a = useHomeAccessibility();
  const style = mapStyle(props.style, a.mapper);
  if (a.hideImages) {
    return <RNView style={[style, { backgroundColor: a.mapper ? a.mapper('#E8EDF2', 'bg') : '#E8EDF2' }]} accessibilityLabel={props.accessibilityLabel} />;
  }
  return <RNImage {...props} style={style} tintColor={mapColor(props.tintColor, a.mapper)} ref={ref} />;
});
ImageBase.displayName = 'ThemedImage';
export const Image = Object.assign(ImageBase, { getSize: RNImage.getSize, prefetch: RNImage.prefetch, resolveAssetSource: RNImage.resolveAssetSource }) as unknown as typeof RNImage;

const ImageBgBase: any = forwardRef<any, any>((props, ref) => {
  const a = useHomeAccessibility();
  const style = mapStyle(props.style, a.mapper);
  if (a.hideImages) return <RNView style={[style, { backgroundColor: a.mapper ? a.mapper('#E8EDF2', 'bg') : '#E8EDF2' }]}>{props.children}</RNView>;
  return <RNImageBackground {...props} style={style} imageStyle={mapStyle(props.imageStyle, a.mapper)} ref={ref} />;
});
ImageBgBase.displayName = 'ThemedImageBackground';
export const ImageBackground = ImageBgBase as unknown as typeof RNImageBackground;

// ------------------------------------------------------------------ small controls
function themedColorProps<P extends object>(Base: any, fg: string[] = [], bg: string[] = [], arrays: string[] = []): React.ComponentType<P> {
  const W = forwardRef<any, any>((props, ref) => {
    const a = useHomeAccessibility();
    if (!a.mapper) return <Base {...props} ref={ref} />;
    const next: any = { ...props };
    if ('style' in next) next.style = mapStyle(next.style, a.mapper);
    for (const k of fg) if (typeof next[k] === 'string') next[k] = mapColor(next[k], a.mapper, 'fg');
    for (const k of bg) if (typeof next[k] === 'string') next[k] = mapColor(next[k], a.mapper, 'bg');
    for (const k of arrays) if (Array.isArray(next[k])) next[k] = next[k].map((c: any) => mapColor(c, a.mapper, 'bg'));
    return <Base {...next} ref={ref} />;
  });
  W.displayName = `Themed(${Base.displayName || Base.name || 'Component'})`;
  return W as unknown as React.ComponentType<P>;
}

export const ActivityIndicator = themedColorProps(RNActivityIndicator, ['color']) as unknown as typeof RNActivityIndicator;
export const RefreshControl = themedColorProps(RNRefreshControl, ['tintColor', 'titleColor'], ['progressBackgroundColor'], ['colors']) as unknown as typeof RNRefreshControl;
export const Ionicons = themedColorProps(RNIonicons as any, ['color']) as unknown as typeof RNIonicons;
export const MaterialCommunityIcons = themedColorProps(RNMCI as any, ['color']) as unknown as typeof RNMCI;
export const MaterialIcons = themedColorProps(RNMI as any, ['color']) as unknown as typeof RNMI;
const RNGradient: any = RNLinearGradient;
const GradientBase: any = forwardRef<any, any>((props, ref) => {
  const a = useHomeAccessibility();
  const solid = props.style && shadowNoBg(props.style) ? { backgroundColor: Array.isArray(props.colors) && typeof props.colors[0] === 'string' ? props.colors[0] : '#FFFFFF' } : null;
  if (!a.mapper && !solid) return <RNGradient {...props} ref={ref} />;
  const next: any = { ...props, style: solid ? [props.style, solid] : props.style };
  if (a.mapper) {
    next.style = mapStyle(next.style, a.mapper);
    if (Array.isArray(next.colors)) next.colors = next.colors.map((c: any) => mapColor(c, a.mapper, 'bg'));
  }
  return <RNGradient {...next} ref={ref} />;
});
GradientBase.displayName = 'ThemedLinearGradient';
export const LinearGradient = GradientBase as unknown as typeof RNLinearGradient;
// copy the static glyph tables the icon sets expose (used by some screens for glyphMap lookups)
Object.assign(Ionicons as any, { glyphMap: (RNIonicons as any).glyphMap });
Object.assign(MaterialCommunityIcons as any, { glyphMap: (RNMCI as any).glyphMap });
Object.assign(MaterialIcons as any, { glyphMap: (RNMI as any).glyphMap });

const SwitchBase: any = forwardRef<any, any>((props, ref) => {
  const a = useHomeAccessibility();
  if (!a.mapper) return <RNSwitch {...props} ref={ref} />;
  const next = { ...props };
  if (next.thumbColor) next.thumbColor = mapColor(next.thumbColor, a.mapper, 'bg');
  if (next.trackColor) next.trackColor = { false: mapColor(next.trackColor.false, a.mapper, 'bg'), true: mapColor(next.trackColor.true, a.mapper, 'bg') };
  if (next.ios_backgroundColor) next.ios_backgroundColor = mapColor(next.ios_backgroundColor, a.mapper, 'bg');
  return <RNSwitch {...next} ref={ref} />;
});
SwitchBase.displayName = 'ThemedSwitch';
export const Switch = SwitchBase as unknown as typeof RNSwitch;

/** The status bar text must be light on dark screens, whatever a screen asks for. */
const StatusBarBase: any = (props: any) => {
  const a = useHomeAccessibility();
  return <RNStatusBar {...props} barStyle={a.dark ? 'light-content' : (props.barStyle ?? 'dark-content')} backgroundColor={props.backgroundColor ? mapColor(props.backgroundColor, a.mapper, 'bg') : props.backgroundColor} />;
};
StatusBarBase.displayName = 'ThemedStatusBar';
export const StatusBar = Object.assign(StatusBarBase, { setBarStyle: RNStatusBar.setBarStyle, setHidden: RNStatusBar.setHidden, currentHeight: RNStatusBar.currentHeight }) as unknown as typeof RNStatusBar;

// ------------------------------------------------------------------ svg drawings (rings, charts, maps)
// Fill and stroke colours follow the theme too. A dark colour becomes light on a dark screen and a light track becomes dark;
// bright brand colours stay as they are.
function svgColor(c: any, map: Mapper | null, textual: boolean) {
  if (!map || typeof c !== 'string') return c;
  const first = map(c, 'fg');
  if (first !== c) return first;
  return map(c, textual ? 'fg' : 'border');
}
function themedSvg(Base: any, textual = false) {
  const W = forwardRef<any, any>((props, ref) => {
    const a = useHomeAccessibility();
    if (!a.mapper) return <Base {...props} ref={ref} />;
    const next: any = { ...props };
    for (const k of ['fill', 'stroke', 'stopColor', 'color']) if (typeof next[k] === 'string') next[k] = svgColor(next[k], a.mapper, textual || k === 'color');
    return <Base {...next} ref={ref} />;
  });
  W.displayName = `ThemedSvg(${Base.displayName || Base.name || 'Shape'})`;
  return W as unknown as typeof Base;
}
export const Circle = themedSvg(RNSvg.Circle) as typeof RNSvg.Circle;
export const Line = themedSvg(RNSvg.Line) as typeof RNSvg.Line;
export const Path = themedSvg(RNSvg.Path) as typeof RNSvg.Path;
export const Rect = themedSvg(RNSvg.Rect) as typeof RNSvg.Rect;
export const Polyline = themedSvg(RNSvg.Polyline) as typeof RNSvg.Polyline;
export const Polygon = themedSvg(RNSvg.Polygon) as typeof RNSvg.Polygon;
export const Stop = themedSvg(RNSvg.Stop) as typeof RNSvg.Stop;
export const SvgText = themedSvg(RNSvg.Text, true) as typeof RNSvg.Text;
