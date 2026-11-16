import React, { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { theme } from '../constants/theme';
import { assetUrl } from '../services/api';
import { T } from './ui';
import { Image, ScrollView, View } from './themed';

const C = theme.COLORS;

/**
 * The pictures of a post. One picture fills the width. Several can be swiped through, with "2 / 5" on the picture and dots underneath.
 * In a feed card (`compact`) only the first picture shows, with a "+4" badge so people know there are more.
 */
export function PostImages({ urls, height = 220, compact }: { urls: string[]; height?: number; compact?: boolean }) {
  const [i, setI] = useState(0);
  const [width, setWidth] = useState(0);          // measured, because a sideways gallery needs real pixels to page by
  if (!urls.length) return null;
  const box = { width: width || '100%', height, borderRadius: 14, backgroundColor: C.borderLight } as any;
  if (compact || urls.length === 1) {
    return (
      <View style={{ marginTop: 10 }}>
        <Image source={{ uri: assetUrl(urls[0]) }} style={{ ...box, width: '100%' }} resizeMode="cover" accessibilityLabel={urls.length > 1 ? `Photo 1 of ${urls.length}` : 'Attached photo'} />
        {compact && urls.length > 1 ? (
          <View style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T v="label" color="#fff" style={{ fontSize: 12 }}>+{urls.length - 1} more</T>
          </View>
        ) : null}
      </View>
    );
  }
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.max(0, Math.min(urls.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
  return (
    <View style={{ marginTop: 12 }} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} style={{ borderRadius: 14 }}>
        {urls.map((u, k) => <Image key={`${u}-${k}`} source={{ uri: assetUrl(u) }} style={box} resizeMode="cover" accessibilityLabel={`Photo ${k + 1} of ${urls.length}`} />)}
      </ScrollView>
      <View style={{ position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
        <T v="label" color="#fff" style={{ fontSize: 12 }}>{i + 1} / {urls.length}</T>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {urls.map((_, k) => <View key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.primary : C.border }} />)}
      </View>
    </View>
  );
}
