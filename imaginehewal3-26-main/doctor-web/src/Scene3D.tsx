import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** A slowly turning 3D ECG trace with a field of points behind it. Pure decoration, hidden from assistive tech,
 *  paused when the tab is hidden, and a still frame for people who ask their system for reduced motion. */
function ecgPoints(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const beats = 4, per = 60;
  for (let b = 0; b < beats; b++) {
    for (let i = 0; i < per; i++) {
      const u = i / per;
      let y = 0;
      y += 0.12 * Math.exp(-Math.pow((u - 0.18) / 0.05, 2));       // P wave
      y -= 0.14 * Math.exp(-Math.pow((u - 0.40) / 0.012, 2));      // Q
      y += 1.0 * Math.exp(-Math.pow((u - 0.43) / 0.014, 2));       // R spike
      y -= 0.28 * Math.exp(-Math.pow((u - 0.46) / 0.014, 2));      // S
      y += 0.26 * Math.exp(-Math.pow((u - 0.70) / 0.07, 2));       // T wave
      pts.push(new THREE.Vector3((b + u) * 1.6 - (beats * 1.6) / 2, y * 1.4, 0));
    }
  }
  return pts;
}

export default function Scene3D() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }   // no WebGL: the page still works
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.4, 7.2);

    const curve = new THREE.CatmullRomCurve3(ecgPoints());
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 600, 0.045, 10, false),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, emissive: 0x2a2a2a, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.2 }),
    );
    const group = new THREE.Group();
    group.add(tube);
    // two faint copies behind it give depth
    [-0.9, -1.8].forEach((z, i) => {
      const t = tube.clone();
      t.material = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 - i * 0.06, roughness: 1 });
      t.position.z = z; t.position.y = -0.15 * (i + 1);
      group.add(t);
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
    ring.rotation.x = Math.PI / 2.6;
    group.add(ring);
    scene.add(group);

    const N = 420, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = (Math.random() - 0.5) * 9; pos[i * 3 + 2] = -Math.random() * 7; }
    const dots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.5 }));
    scene.add(dots);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.PointLight(0xffffff, 40, 30); key.position.set(3, 4, 6); scene.add(key);

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mx = 0, my = 0, raf = 0, running = true;
    const onMove = (e: PointerEvent) => { mx = (e.clientX / window.innerWidth - 0.5); my = (e.clientY / window.innerHeight - 0.5); };
    window.addEventListener('pointermove', onMove);
    const clock = new THREE.Clock();
    const frame = () => {
      if (!running) return;
      const t = clock.getElapsedTime();
      group.rotation.y += ((reduce ? -0.35 : Math.sin(t * 0.25) * 0.5 + mx * 0.6) - group.rotation.y) * 0.04;
      group.rotation.x += ((reduce ? 0.1 : my * 0.3 + 0.08) - group.rotation.x) * 0.04;
      group.position.y = 1.5 + (reduce ? 0 : Math.sin(t * 0.6) * 0.08);   // held high so the headline stays readable
      ring.rotation.z = t * 0.12;
      dots.rotation.y = t * 0.02;
      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();
    const vis = () => { running = !document.hidden; if (running && !reduce) { clock.getDelta(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', vis);

    return () => {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', vis);
      scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | undefined; mat?.dispose?.(); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div ref={host} className="scene3d" aria-hidden="true" />;
}
