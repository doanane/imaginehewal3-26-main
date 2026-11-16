import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Vibration } from 'react-native';
import { theme } from '../constants/theme';
import { useEmergency } from '../contexts/EmergencyContext';
import { useT } from '../i18n';
import api from '../services/api';
import { Button, T } from './ui';
import { Ionicons, SafeAreaView, ScrollView, View } from './themed';

const C = theme.COLORS;

/** Full-screen alert for caregivers when someone they care for needs help. Mounted once at the app root. */
export default function EmergencyAlertModal() {
  const { incoming, dismiss, refresh } = useEmergency();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const ev = incoming[0];

  useEffect(() => {
    if (ev) Vibration.vibrate([0, 600, 300, 600, 300, 600]);
    return () => Vibration.cancel();
  }, [ev?.id, ev?.status]);

  if (!ev) return null;
  const escalated = ev.status === 'escalated';

  const respond = async () => {
    setBusy(true);
    try { await api.ackEmergency(ev.id); await refresh(); }
    catch (e: any) { Alert.alert(t('em.title'), e.message || 'Could not send your response. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => dismiss(ev.id)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.danger }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={48} color="#fff" />
            </View>
            <T v="display" color="#fff" style={{ textAlign: 'center', marginTop: 20 }}>{t('em.cg_title', { name: ev.patient_name })}</T>
            <T v="body" color="#fff" style={{ textAlign: 'center', marginTop: 8 }}>{ev.reason}</T>
            <T v="label" color="rgba(255,255,255,0.9)" style={{ marginTop: 12 }}>
              {escalated ? t('em.cg_escalated') : t('em.cg_attempt', { n: Math.max(1, ev.attempts), max: ev.max_attempts })}
            </T>
          </View>

          {ev.dispatch_mode !== 'live' ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: 12, marginTop: 20 }}>
              <T v="caption" color="#fff">{t('em.simulation')}</T>
            </View>
          ) : null}

          <View style={{ flex: 1 }} />
          <View style={{ gap: 12, marginTop: 24 }}>
            <Button title={t('em.cg_responding')} icon="checkmark-circle" onPress={respond} loading={busy} style={{ backgroundColor: '#fff', borderColor: '#fff' }} textColor={C.danger} />
            {ev.patient_phone
              ? <Button title={t('em.cg_call', { name: ev.patient_name })} icon="call" variant="secondary" onPress={() => Linking.openURL(`tel:${ev.patient_phone}`)} />
              : <T v="caption" color="#fff" style={{ textAlign: 'center' }}>{t('em.cg_no_phone')}</T>}
            {ev.location_url ? <Button title={t('em.cg_map')} icon="location" variant="secondary" onPress={() => Linking.openURL(ev.location_url!)} /> : null}
            <Button title={t('em.cg_dismiss')} variant="ghost" onPress={() => dismiss(ev.id)} textColor="#fff" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
