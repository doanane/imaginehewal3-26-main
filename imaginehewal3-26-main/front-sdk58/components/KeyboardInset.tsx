import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * Keeps the screen above the on-screen keyboard on Android.
 *
 * The app draws edge to edge, and in that mode Android no longer shrinks the window when the keyboard opens, so the keyboard sat on top of the
 * text box and hid what was being typed. This measures how far the keyboard overlaps the bottom of the app and pads the whole app by that
 * much, so the box you are typing in (and everything under it) moves up, with the keyboard right below it. A screen that already handles the
 * keyboard itself measures no overlap any more, so nothing is padded twice. iPhone is unchanged: it already handles this.
 */
export function KeyboardInset({ children }: { children: React.ReactNode }) {
  const outer = useRef<any>(null);                 // never padded, so what it measures is always the real size of the app
  const [pad, setPad] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      outer.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => setPad(Math.max(0, Math.round(y + h - e.endCoordinates.screenY))));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setPad(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (Platform.OS !== 'android') return <>{children}</>;
  return (
    <View ref={outer} style={{ flex: 1 }} collapsable={false}>
      <View style={{ flex: 1, paddingBottom: pad }}>{children}</View>
    </View>
  );
}
