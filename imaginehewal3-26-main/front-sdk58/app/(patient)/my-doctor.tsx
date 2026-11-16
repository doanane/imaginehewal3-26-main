import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Button, Card, Screen, ScreenHeader, Section, Skeleton, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { View } from '../../components/themed';

const C = theme.COLORS;
type Req = { id: number; message: string | null; doctor: { doctor_id: string; full_name: string; specialization: string; hospital: string } };
type Doc = { doctor_id: string; full_name: string; specialization: string; hospital: string } | null;

export default function MyDoctor() {
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | undefined>(undefined);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);

  const load = useCallback(async () => {
    api.getDoctorRequests().then((r) => setReqs(r.requests)).catch(() => setReqs([]));
    try { setDoc((await api.getMyDoctor()).doctor); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load your doctor.'); setDoc((d) => d ?? null); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['doctor_link.request', 'notification.new']);          // a doctor's request shows up at once

  const link = async () => {
    if (code.trim().length < 3) { setError('Enter the Doctor ID your clinic gave you.'); return; }
    setBusy(true); setError(null);
    try { setDoc((await api.linkMyDoctor(code.trim())).doctor); setCode(''); }
    catch (e: any) { setError(e?.message || 'Could not link that doctor.'); }
    finally { setBusy(false); }
  };
  const answer = (r: Req, accept: boolean) => {
    const go = async () => {
      try { const out = await api.answerDoctorRequest(r.id, accept); if (out.status === 'accepted') setDoc(out.doctor); await load(); }
      catch (e: any) { setError(e?.message || 'Could not answer that request.'); }
    };
    if (accept && doc && doc.doctor_id !== r.doctor.doctor_id) {
      Alert.alert(`Switch to ${r.doctor.full_name}?`, `${doc.full_name} will no longer see your health information.`, [{ text: 'Keep my doctor', style: 'cancel' }, { text: 'Switch', onPress: go }]);
    } else go();
  };
  const unlink = () => Alert.alert('Stop sharing with this doctor?', 'They will no longer see your health information. You can link again any time.', [
    { text: 'Keep sharing', style: 'cancel' },
    { text: 'Stop sharing', style: 'destructive', onPress: async () => { try { await api.unlinkMyDoctor(); setDoc(null); } catch (e: any) { setError(e?.message || 'Could not unlink.'); } } },
  ]);

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="My doctor" subtitle="Who can see your health" onBack={() => router.back()} />} keyboard contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} /> : null}
        {reqs.map((r) => (
          <Card key={r.id} tone="soft">
            <T v="overline" color={C.primary}>Request from a doctor</T>
            <T v="title">{r.doctor.full_name}</T>
            <T v="body" color={C.textSecondary}>{[r.doctor.specialization, r.doctor.hospital].filter(Boolean).join(' · ')}</T>
            {r.message ? <T v="body" style={{ marginTop: 6 }}>“{r.message}”</T> : null}
            <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>If you accept, this doctor can see your heart rate, oxygen, blood pressure, steps, medicines, meals and emergencies, and can chat and call you. They cannot change anything. You can stop at any time. Nothing is shared until you accept.</T>
            <View style={{ gap: 8, marginTop: 12 }}>
              <Button title="Accept" icon="checkmark-circle-outline" onPress={() => answer(r, true)} />
              <Button title="Decline" variant="secondary" onPress={() => answer(r, false)} />
            </View>
          </Card>
        ))}
        {doc === undefined ? <Skeleton height={110} /> : doc ? (
          <>
            <Card tone="soft">
              <T v="caption" color={C.textSecondary}>Linked doctor</T>
              <T v="title">{doc.full_name}</T>
              <T v="body" color={C.textSecondary}>{[doc.specialization, doc.hospital].filter(Boolean).join(' · ')}</T>
              <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>Doctor ID {doc.doctor_id}</T>
            </Card>
            <Button title="Message or call your doctor" icon="chatbubbles-outline" onPress={() => router.push('/(patient)/doctor-chat' as any)} />
            <Button title="Appointments" variant="secondary" icon="calendar-outline" onPress={() => router.push('/(patient)/doctor-appointments' as any)} />
            <Button title="Medicines and notes from my doctor" variant="secondary" icon="document-text-outline" onPress={() => router.push('/(patient)/doctor-care' as any)} />
            <Banner tone="info" text="Your doctor can see your heart rate, oxygen, blood pressure, steps, medicines, meals and emergencies, and can chat and call you. They cannot change anything." />
            <Button title="Stop sharing with this doctor" variant="secondary" onPress={unlink} />
          </>
        ) : (
          <>
            <Banner tone="info" text="Link your doctor so they can follow your health between visits. Your clinic gives you a Doctor ID." />
            <Section title="Doctor ID">
              <View style={{ gap: 12 }}>
                <TextField label="Doctor ID" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="For example DOC00001" />
                <Button title="Link my doctor" icon="medkit-outline" loading={busy} onPress={link} />
              </View>
            </Section>
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
