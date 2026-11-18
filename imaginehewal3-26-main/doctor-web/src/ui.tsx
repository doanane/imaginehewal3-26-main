import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { GROUP_LABEL, initials } from './util';

/** Card that leans toward the pointer in 3D and lifts a little. Disabled for reduced-motion users and on touch. */
export function Tilt({ children, className = '', max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 20 }), sy = useSpring(my, { stiffness: 220, damping: 20 });
  const rotY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotX = useTransform(sy, [-0.5, 0.5], [max, -max]);
  const glowX = useTransform(sx, [-0.5, 0.5], ['20%', '80%']);
  const glowY = useTransform(sy, [-0.5, 0.5], ['20%', '80%']);
  const ref = useRef<HTMLDivElement>(null);
  if (reduce) return <div className={`tilt ${className}`}>{children}</div>;
  return (
    <div className="tilt-stage">
      <motion.div
        ref={ref} className={`tilt ${className}`} style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}
        whileHover={{ y: -3 }}
        onPointerMove={e => {
          if (e.pointerType === 'touch' || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onPointerLeave={() => { mx.set(0); my.set(0); }}
      >
        <motion.span className="tilt-glow" style={{ left: glowX, top: glowY }} aria-hidden />
        {children}
      </motion.div>
    </div>
  );
}

/** Number that counts up to its value. Shows the final number at once for reduced motion. */
export function CountUp({ value, digits = 0, suffix = '' }: { value: number; digits?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => `${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
    if (reduce) { el.textContent = fmt(value); last.current = value; return; }
    const c = animate(last.current, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: v => { el.textContent = fmt(v); } });
    last.current = value;
    return () => c.stop();
  }, [value, digits, suffix, reduce]);
  return <span ref={ref}>{value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}{suffix}</span>;
}

export const Badge = ({ group }: { group: string }) => <span className={`badge ${group}`}><i />{GROUP_LABEL[group] || group}</span>;

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.v === value && <motion.span layoutId={`seg-${label}`} className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = '100%' }: { h?: number; w?: number | string }) => <div className="skeleton" style={{ height: h, width: w }} />;

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return <div className="empty"><div className="empty-ic">{icon}</div><b>{title}</b>{children && <p>{children}</p>}</div>;
}


/** A person's picture when they have one (and it loads), otherwise their initials. */
export function Avatar({ name, photo, className = '' }: { name: string; photo?: string | null; className?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [photo]);
  if (photo && !bad) return <img className={`avatar photo ${className}`} src={photo} alt="" onError={() => setBad(true)} />;
  return <span className={`avatar ${className}`} aria-hidden>{initials(name)}</span>;
}
