/**
 * Direct Bluetooth Low Energy connection to a watch or band, using the standard Bluetooth profiles that many devices support:
 *   Heart Rate service 0x180D (measurement 0x2A37) and Battery service 0x180F (level 0x2A19).
 * Readings are sent to the backend as device "watch-ble", exactly like Apple Health readings, so alerts, caregivers and charts work the same.
 *
 * Honest limit: many budget watches (including some oraimo models) talk to their own app over a private protocol and do not expose
 * the standard heart-rate service. For those, the scan still lists the watch and shows what it exposes; data then has to come through
 * the watch maker's app syncing to Apple Health. Needs a development build: Expo Go has no Bluetooth module.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { bluetoothModulePresent } from './native';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
const BATTERY_LEVEL = '00002a19-0000-1000-8000-00805f9b34fb';
const LAST_KEY = 'hewal3.watch.last';

export type FoundWatch = { id: string; name: string; rssi: number | null; standardHr: boolean };
export type WatchStatus = { state: 'idle' | 'connecting' | 'connected' | 'no-hr' | 'error'; message?: string; name?: string; hr?: number | null; battery?: number | null; services?: string[] };

let manager: any | null | undefined;
function ble(): any | null {
  if (manager !== undefined) return manager;
  if (!bluetoothModulePresent()) { manager = null; return manager; }      // this build has no Bluetooth module
  try { const { BleManager } = require('react-native-ble-plx'); manager = new BleManager(); } catch { manager = null; }
  return manager;
}
export const bluetoothAvailable = () => ble() !== null;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fromBase64(b64: string): number[] {
  const out: number[] = []; let bits = 0, acc = 0;
  for (const ch of b64.replace(/=+$/, '')) { const v = B64.indexOf(ch); if (v < 0) continue; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); } }
  return out;
}
/** Heart Rate Measurement: flags bit 0 says whether the value is 8 or 16 bit. */
export function parseHeartRate(b64: string): number | null {
  const b = fromBase64(b64); if (b.length < 2) return null;
  const v = b[0] & 1 ? b[1] | (b[2] << 8) : b[1];
  return v >= 25 && v <= 250 ? v : null;                    // outside this range the reading is noise, not a heartbeat
}

/** Waits for Bluetooth to be switched on, then lists nearby named devices. Returns a function that stops the scan. */
export async function scanWatches(onFound: (w: FoundWatch) => void, onProblem: (m: string) => void): Promise<() => void> {
  const m = ble();
  if (!m) { onProblem('Bluetooth is not available in this app build. Use the development build (not Expo Go).'); return () => {}; }
  const state = await m.state();
  if (state !== 'PoweredOn') {
    onProblem(state === 'Unauthorized' ? 'Allow Bluetooth for HEWAL3 in Settings.' : 'Switch Bluetooth on to find your watch.');
    return () => {};
  }
  const seen = new Set<string>();
  m.startDeviceScan(null, { allowDuplicates: false }, (err: any, d: any) => {
    if (err) { onProblem(err.message || 'Scan failed.'); return; }
    const name = d?.name || d?.localName;
    if (!d || !name || seen.has(d.id)) return;
    seen.add(d.id);
    const uuids: string[] = (d.serviceUUIDs || []).map((u: string) => u.toLowerCase());
    onFound({ id: d.id, name, rssi: d.rssi ?? null, standardHr: uuids.some((u) => u.includes('180d')) });
  });
  return () => { try { m.stopDeviceScan(); } catch { /* already stopped */ } };
}

let current: any | null = null;
let subs: { remove: () => void }[] = [];
let lastSent = 0;

export async function disconnectWatch() {
  subs.forEach((s) => { try { s.remove(); } catch { /* gone */ } }); subs = [];
  try { await current?.cancelConnection(); } catch { /* already disconnected */ }
  current = null;
  await AsyncStorage.removeItem(LAST_KEY).catch(() => {});
}

/** Connects, reads battery, and streams heart rate. Calls onStatus on every change and uploads a reading about every 10 seconds. */
export async function connectWatch(id: string, onStatus: (s: WatchStatus) => void): Promise<void> {
  const m = ble();
  if (!m) { onStatus({ state: 'error', message: 'Bluetooth is not available in this app build.' }); return; }
  onStatus({ state: 'connecting' });
  try {
    await disconnectWatch();
    const dev = await m.connectToDevice(id, { timeout: 15000 });
    current = await dev.discoverAllServicesAndCharacteristics();
    const name = dev.name || 'Watch';
    const services: string[] = (await current.services()).map((s: any) => s.uuid.toLowerCase());
    const hasHr = services.includes(HR_SERVICE);
    let battery: number | null = null;
    if (services.includes(BATTERY_SERVICE)) {
      try { const c = await current.readCharacteristicForService(BATTERY_SERVICE, BATTERY_LEVEL); battery = fromBase64(c.value || '')[0] ?? null; } catch { /* battery not readable */ }
    }
    if (!hasHr) {
      onStatus({ state: 'no-hr', name, battery, services, message: 'This watch does not share heart rate over standard Bluetooth. It likely uses its maker\'s private protocol.' });
      return;
    }
    await AsyncStorage.setItem(LAST_KEY, id).catch(() => {});
    onStatus({ state: 'connected', name, battery, hr: null, services });
    subs.push(current.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT, (err: any, ch: any) => {
      if (err) { onStatus({ state: 'error', message: 'The watch disconnected.', name }); return; }
      const hr = ch?.value ? parseHeartRate(ch.value) : null;
      if (hr == null) return;
      onStatus({ state: 'connected', name, battery, hr, services });
      if (Date.now() - lastSent >= 10000) {
        lastSent = Date.now();
        api.ingestVitals({ device_id: 'watch-ble', device_name: name, heart_rate: hr }).catch(() => {});
      }
    }));
    subs.push(m.onDeviceDisconnected(id, () => onStatus({ state: 'error', message: 'The watch disconnected. Move closer and reconnect.', name })));
  } catch (e: any) {
    onStatus({ state: 'error', message: e?.message?.includes('timed out') ? 'Could not reach the watch. Keep it close and awake, and close its own app.' : (e?.message || 'Could not connect.') });
  }
}

export const lastWatchId = () => AsyncStorage.getItem(LAST_KEY).catch(() => null);
