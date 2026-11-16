import type * as Location from 'expo-location';
import { getLocation } from '../../services/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Vibration } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Button, Card, Screen, T } from '../../components/ui';
import { Pulse } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import { isOpen, useEmergency } from '../../contexts/EmergencyContext';
import { useT } from '../../i18n';
import api, { SosEvent } from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;
const secondsUntil = (iso: string | null | undefined, now: number) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : 0);

function Step({ done, active, text }: { done: boolean; active: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: done ? C.success : active ? C.warningLight : C.borderLight, borderWidth: active ? 2 : 0, borderColor: C.warning }}>
        <Ionicons name={done ? 'checkmark' : active ? 'time-outline' : 'ellipse-outline'} size={16} color={done ? '#fff' : active ? C.warning : C.textMuted} />
      </View>
      <T v={done || active ? 'bodyStrong' : 'body'} color={done || active ? C.textPrimary : C.textSecondary} style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

export default function EmergencyScreen() {
  const router = useRouter();
  const { mine, refresh } = useEmergency();
  const { t } = useT();
  const [now, setNow] = useState(Date.now());
  const [sim, setSim] = useState(true);
  const [number, setNumber] = useState('112');
  const [locState, setLocState] = useState<'idle' | 'sharing' | 'denied'>('idle');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const prompted = useRef(false);
  const watch = useRef<Location.LocationSubscription | null>(null);
  const lastSent = useRef(0);
  const ev: SosEvent | null = mine;

  useEffect(() => { refresh(); api.getEmergencyConfig().then((c) => { setSim(c.simulation); setNumber(c.emergency_number); }).catch(() => {}); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id); }, []);

  // Share live location for as long as the emergency is open
  const openNow = isOpen(ev);
  useEffect(() => {
    if (!ev || !openNow) { watch.current?.remove(); watch.current = null; return; }
    let cancelled = false;
    (async () => {
      const Location = getLocation();
      if (!Location) { if (!cancelled) setLocState('denied'); return; }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { if (!cancelled) setLocState('denied'); return; }
      watch.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 }, (pos) => {
        if (Date.now() - lastSent.current < 4000) return;
        lastSent.current = Date.now();
        setAccuracy(pos.coords.accuracy ?? null); setLocState('sharing');
        api.shareEmergencyLocation(ev.id, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy).catch(() => {});
      });
    })().catch(() => setLocState('denied'));
    return () => { cancelled = true; watch.current?.remove(); watch.current = null; };
  }, [ev?.id, openNow]);

  // When it escalates: vibrate and, in live mode, offer the call straight away
  useEffect(() => {
    if (ev?.status === 'escalated' && !prompted.current) {
      prompted.current = true;
      Vibration.vibrate([0, 700, 300, 700]);
      if (!sim) Alert.alert(t('em.title'), t('em.call_now', { number }), [{ text: t('em.cancel'), style: 'cancel' }, { text: t('em.call_now', { number }), style: 'destructive', onPress: () => Linking.openURL(`tel:${number}`) }]);
    }
  }, [ev?.status, sim, number]);

  const act = async (fn: (id: number) => Promise<any>) => { if (!ev) return; try { await fn(ev.id); await refresh(); } catch (e: any) { Alert.alert(t('em.title'), e.message); } };
  const confirmCancel = () => act(api.cancelEmergency);

  if (!ev) {
    return (<ProtectedRoute><Screen><View style={{ padding: 24, alignItems: 'center' }}><T v="heading">{t('em.title')}</T><Button title={t('em.done')} onPress={() => router.back()} style={{ marginTop: 16, alignSelf: 'stretch' }} /></View></Screen></ProtectedRoute>);
  }

  const pending = ev.status === 'pending';
  const closed = ev.status === 'cancelled' || ev.status === 'resolved';
  const escalated = ev.status === 'escalated';
  const acked = ev.status === 'acknowledged' || !!ev.acknowledged_by;
  const graceLeft = secondsUntil(ev.grace_until, now);
  const nextIn = secondsUntil(ev.next_action_at, now);
  const bg = closed ? C.success : C.danger;

  return (
    <ProtectedRoute>
      <Screen bg={bg} contentStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Pulse active={!closed}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={closed ? 'checkmark-circle' : 'warning'} size={54} color="#fff" />
            </View>
          </Pulse>
          <T v="display" color="#fff" style={{ marginTop: 16 }}>{closed ? (ev.status === 'cancelled' ? t('em.cancelled') : t('em.resolved')) : t('em.title')}</T>
          <T v="body" color="rgba(255,255,255,0.95)" style={{ textAlign: 'center', marginTop: 6 }}>{ev.reason}</T>
          <T v="caption" color="rgba(255,255,255,0.85)" style={{ textAlign: 'center', marginTop: 2 }}>{ev.trigger === 'auto_vitals' ? t('em.auto_detected') : t('em.manual')}</T>
        </View>

        {sim && !closed ? <View style={{ marginTop: 16 }}><Banner tone="warning" text={t('em.simulation')} /></View> : null}

        {pending ? (
          <Card style={{ marginTop: 20, alignItems: 'center' }}>
            <T v="body" color={C.textSecondary}>{t('em.alerting_in')}</T>
            <T v="display" style={{ fontSize: 72, lineHeight: 84 }} color={C.danger}>{graceLeft}</T>
            <T v="caption" color={C.textSecondary}>{t('em.seconds')}</T>
            <Button title={t('em.im_ok')} icon="close-circle" onPress={confirmCancel} style={{ alignSelf: 'stretch', marginTop: 16, minHeight: 64 }} />
          </Card>
        ) : null}

        {!pending && !closed ? (
          <Card style={{ marginTop: 20 }}>
            <Step done={ev.attempts >= 1} active={ev.attempts < 1} text={t('em.step_alert1')} />
            <Step done={ev.attempts >= 2} active={ev.attempts === 1 && !acked && !escalated} text={t('em.step_alert2')} />
            <Step done={escalated} active={ev.attempts >= 2 && !escalated && !acked} text={t('em.step_services', { number })} />
            {acked ? <View style={{ marginTop: 10 }}><Banner tone="success" text={t('em.responding')} /></View>
              : !escalated && nextIn > 0 ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>{t('em.waiting')}. {t('em.next_in', { s: nextIn })}</T> : null}
          </Card>
        ) : null}

        {escalated && !closed ? (
          <Button title={t('em.call_now', { number })} icon="call" variant="secondary" onPress={() => Linking.openURL(`tel:${number}`)} style={{ marginTop: 16, minHeight: 64 }} />
        ) : null}

        {!closed ? (
          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={locState === 'sharing' ? 'location' : 'location-outline'} size={22} color={locState === 'denied' ? C.danger : C.primary} />
              <T v="bodyStrong" style={{ flex: 1 }}>{locState === 'denied' ? t('em.location_off') : t('em.sharing')}</T>
            </View>
            {locState === 'sharing' && accuracy ? <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>±{Math.round(accuracy)} m</T> : null}
            {locState === 'denied' ? <Button title={t('em.open_settings')} variant="secondary" onPress={() => Linking.openSettings()} style={{ marginTop: 10 }} /> : null}
          </Card>
        ) : null}

        {ev.timeline?.length ? (
          <Card style={{ marginTop: 16 }}>
            <T v="overline" color={C.textSecondary} style={{ marginBottom: 6 }}>{t('em.timeline')}</T>
            {ev.timeline.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 5 }}>
                <T v="caption" color={C.textTertiary}>{l.at ? new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''}</T>
                <T v="caption" style={{ flex: 1 }}>{l.detail}</T>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ marginTop: 20, gap: 10 }}>
          {!closed && !pending ? <>
            <Button title={t('em.resolve')} variant="secondary" onPress={() => act(api.resolveEmergency)} />
            <Button title={t('em.im_ok')} variant="ghost" textColor="#fff" onPress={confirmCancel} />
          </> : null}
          {closed ? <Button title={t('em.done')} variant="secondary" onPress={() => router.replace('/(patient)/(tabs)/today' as any)} /> : null}
        </View>
      </Screen>
    </ProtectedRoute>
  );
}
