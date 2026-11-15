import React from 'react';
import logo from './assets/logo.png';

/** The HEWAL3 logo (front/assets/images/logo.png), cropped to its artwork on a white plate so it reads in light and dark. */
export default function Logo({ width = 150, className = '' }: { width?: number; className?: string }) {
  return (
    <span className={`brand-logo ${className}`} style={{ width }} role="img" aria-label="HEWAL3">
      <img src={logo} alt="" draggable={false} />
    </span>
  );
}
