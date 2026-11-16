import React from 'react';
import { Image } from './themed';

/** The HEWAL3 logo (front/assets/images/logo.png), used on activity screens and summaries. */
export default function BrandLogo({ width = 72, height = 30 }: { width?: number; height?: number }) {
  return <Image source={require('../assets/images/logo.png')} style={{ width, height }} resizeMode="contain" accessibilityLabel="HEWAL3" />;
}
