import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, Chip, Screen, ScreenHeader, Section, Skeleton, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { connectHealthKit } from '../../services/healthkit';
import { useHealthSync } from '../../services/healthSync';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;
const GENDERS = ['Female', 'Male', 'Other'];
const CONDITIONS = ['Hypertension', 'Type 2 diabetes', 'Type 1 diabetes', 'Heart disease', 'Asthma', 'Kidney disease', 'Stroke history'];

const num = (s: string): number | undefined => { const n = parseInt(s.replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : undefined; };

/** Edit profile. Everything here is saved to the account, and the doctor you chose sees the same details on their website. */
export default function EditProfile() {
  const router = useRouter();
  const sync = useHealthSync();
  const [loaded, setLoaded] = useState(false);
  const [f, setF] = useState({ name: '', age: '', gender: '', height: '', weight: '', family: '', ecName: '', ecPhone: '', ecRel: '' });
  const [conditions, setConditions] = useState<string[]>([]);
  const [doctor, setDoctor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let live = true;
    api.getProfile().then((p) => {
      if (!live) return;
      setF({ name: p.full_name || '', age: p.age ? String(p.age) : '', gender: p.gender || '', height: p.height ? String(p.height) : '', weight: p.weight ? String(p.weight) : '',
        family: (p.family_history || []).join(', '), ecName: p.emergency_contact_name || '', ecPhone: p.emergency_contact_phone || '', ecRel: p.emergency_contact_relationship || '' });
      setConditions(p.chronic_conditions || []);
      setLoaded(true);
    }).catch((e) => { if (live) { setError(e?.message || 'Could not load your details.'); setLoaded(true); } });
    api.getMyDoctor().then((d) => { if (live) setDoctor(d.doctor?.full_name || null); }).catch(() => {});
    return () => { live = false; };
  }, []));

  const set = (k: keyof typeof f) => (v: string) => { setSaved(false); setF((p) => ({ ...p, [k]: v })); };
  const toggle = (c: string) => { setSaved(false); setConditions((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c])); };
  const extra = conditions.filter((c) => !CONDITIONS.includes(c));          // anything saved earlier stays visible and removable

  const save = async () => {
    setError(null);
    const body: any = { chronic_conditions: conditions, family_history: f.family.split(',').map((x) => x.trim()).filter(Boolean) };
    if (f.name.trim()) body.full_name = f.name.trim();
    if (f.gender) body.gender = f.gender;
    if (num(f.age)) body.age = num(f.age);
    if (num(f.height)) body.height = num(f.height);
    if (num(f.weight)) body.weight = num(f.weight);
    body.emergency_contact_name = f.ecName.trim();
    body.emergency_contact_phone = f.ecPhone.trim();
    body.emergency_contact_relationship = f.ecRel.trim();
    setSaving(true);
    try { await api.updateProfile(body); api.invalidateApiCache(); setSaved(true); }
    catch (e: any) { setError(e?.message || 'Could not save. Check your connection and try again.'); }
    finally { setSaving(false); }
  };

  const connectHealth = async () => {
    setBusy(true);
    try {
      const r = await connectHealthKit();
      if (r.connected) { await sync.syncNow({ force: true }); return; }
      Alert.alert('Apple Health', r.reason === 'expo-go' ? 'Apple Health needs the HEWAL3 app build, not Expo Go.'
        : r.reason === 'android' ? 'Apple Health is available on iPhone only.'
        : r.reason === 'permission' ? 'Nothing was shared. You can change this any time in Settings > Health > Data Access & Devices > HEWAL3.'
        : 'Apple Health is not available in this build.');
    } finally { setBusy(false); }
  };

  const connected = sync.status === 'ok' || sync.status === 'syncing';

  return (
    <ProtectedRoute>
      <Screen keyboard
        header={<ScreenHeader title="Edit profile" subtitle="Your details and Apple Health" onBack={() => router.back()} />}
        footer={<View style={{ padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.borderLight }}>
          <Button title={saved ? 'Saved' : 'Save changes'} icon={saved ? 'checkmark' : undefined} onPress={save} loading={saving} disabled={!loaded || saved} />
        </View>}
        contentStyle={{ gap: 14, paddingBottom: 32 }}>
        {error ? <Banner tone="danger" text={error} /> : null}
        {saved ? <Banner tone="success" text={doctor ? `Saved. ${doctor} sees these details on their website.` : 'Saved. If you choose a doctor, they will see these details.'} /> : null}

        {!loaded ? <Card><Skeleton height={20} width="60%" /><Skeleton height={44} style={{ marginTop: 14 }} /><Skeleton height={44} style={{ marginTop: 14 }} /></Card> : (
          <>
            <Section title="About you">
              <Card>
                <TextField label="Full name" value={f.name} onChangeText={set('name')} autoCapitalize="words" textContentType="name" />
                <TextField label="Age" value={f.age} onChangeText={set('age')} keyboardType="number-pad" />
                <T v="label" color={C.textSecondary} style={{ marginBottom: 6 }}>Gender</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {GENDERS.map((g) => <Chip key={g} label={g} selected={f.gender === g} onPress={() => { setSaved(false); setF((p) => ({ ...p, gender: g })); }} />)}
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TextField label="Height (cm)" value={f.height} onChangeText={set('height')} keyboardType="number-pad" style={{ flex: 1 }} />
                  <TextField label="Weight (kg)" value={f.weight} onChangeText={set('weight')} keyboardType="number-pad" style={{ flex: 1 }} />
                </View>
              </Card>
            </Section>

            <Section title="Health history">
              <Card>
                <T v="label" color={C.textSecondary} style={{ marginBottom: 8 }}>Conditions you live with</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[...CONDITIONS, ...extra].map((c) => <Chip key={c} label={c} selected={conditions.includes(c)} onPress={() => toggle(c)} />)}
                </View>
                <TextField label="Family history" helper="For example: diabetes, stroke. Separate with commas." value={f.family} onChangeText={set('family')} style={{ marginBottom: 0 }} />
              </Card>
            </Section>

            <Section title="Emergency contact">
              <Card>
                <TextField label="Name" value={f.ecName} onChangeText={set('ecName')} autoCapitalize="words" />
                <TextField label="Phone" value={f.ecPhone} onChangeText={set('ecPhone')} keyboardType="phone-pad" />
                <TextField label="Relationship" value={f.ecRel} onChangeText={set('ecRel')} autoCapitalize="words" style={{ marginBottom: 0 }} />
              </Card>
            </Section>

            <Section title="Apple Health">
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="heart-outline" size={24} color={C.primary} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{connected ? 'Connected' : 'Connect Apple Health'}</T>
                    <T v="caption" color={C.textSecondary}>Steps, heart rate, sleep and more flow in on their own. You choose what is shared, and can stop any time.</T>
                  </View>
                  {connected ? <Badge label="On" tone="success" /> : null}
                </View>
                {!connected && !skipped ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Button title="Connect" icon="heart" onPress={connectHealth} loading={busy} style={{ flex: 1 }} />
                    <Button title="Skip for now" variant="secondary" onPress={() => setSkipped(true)} style={{ flex: 1 }} />
                  </View>
                ) : null}
                {!connected && skipped ? <T v="caption" color={C.textSecondary} style={{ marginTop: 12 }}>Skipped. You can connect any time under Profile, Connected devices.</T> : null}
                <T v="caption" color={C.textSecondary} style={{ marginTop: 12 }}>Watches, blood pressure cuffs and glucose meters that write to Apple Health appear here once Apple Health is connected.</T>
              </Card>
            </Section>
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
