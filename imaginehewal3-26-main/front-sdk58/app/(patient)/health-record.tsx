import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useRealtimeReload, usePull } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Button, Chip, IconName, Screen, ScreenHeader, Skeleton, T, TextField } from '../../components/ui';
import { Glass, GlassBackdrop } from '../../components/ui/Glass';
import { Ionicons, Pressable, RefreshControl, View } from '../../components/themed';
import { theme } from '../../constants/theme';
import { addAllergy, addImmunisation, createShare, deleteAllergy, deleteImmunisation, deleteInsurance, getPrimaryCare, getRecords, getShares, HealthRecord, PrimaryCare, RecShare, revokeShare, saveInsurance } from '../../services/api';

const C = theme.COLORS;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const today = () => new Date().toISOString().slice(0, 10);
const MODALITY: Record<string, string> = { xray: 'X-ray', ct: 'CT scan', mri: 'MRI', ultrasound: 'Ultrasound', mammogram: 'Mammogram', other: 'Imaging' };
const FLAG_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = { normal: 'success', high: 'warning', low: 'info', critical: 'danger' };
const SEV_TONE: Record<string, 'success' | 'warning' | 'danger'> = { mild: 'success', moderate: 'warning', severe: 'danger' };

/** One glass section of the record: an icon, a title, an optional add button, then its rows. */
function Block({ icon, title, onAdd, children }: { icon: IconName; title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <Glass radius={24} style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={C.primary} /></View>
          <T v="heading">{title}</T>
        </View>
        {onAdd ? <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`Add to ${title}`} hitSlop={10}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add-circle" size={30} color={C.primary} /></Pressable> : null}
      </View>
      {children}
    </Glass>
  );
}

function Row({ title, sub, right, onRemove, label }: { title: string; sub?: string; right?: React.ReactNode; onRemove?: () => void; label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.borderLight }}>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{title}</T>
        {sub ? <T v="caption" color={C.textSecondary}>{sub}</T> : null}
      </View>
      {right}
      {onRemove ? <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={label || 'Remove'} hitSlop={10} style={{ minHeight: 44, minWidth: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="trash-outline" size={18} color={C.textSecondary} /></Pressable> : null}
    </View>
  );
}

/** Your health record: what you and your doctors have added, in one place. You add allergies, vaccines and insurance; your doctor adds results, imaging and visits. */
export default function HealthRecordScreen() {
  const router = useRouter();
  const [rec, setRec] = useState<HealthRecord | null>(null);
  const [shares, setShares] = useState<RecShare[]>([]);
  const [pc, setPc] = useState<PrimaryCare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<'allergy' | 'vaccine' | 'insurance' | null>(null);
  const [f, setF] = useState({ substance: '', reaction: '', severity: 'mild', vaccine: '', dose: '', given_on: today(), provider: '', plan: '', member_no: '', valid_until: '', notes: '', label: '' });
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<string | null>(null);
  const [fresh, setFresh] = useState<RecShare | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [r, s, p] = await Promise.all([getRecords(), getShares(), getPrimaryCare().catch(() => null)]);
      setRec(r); setShares(s.shares); setPc(p); setError(null);
      if (r.insurance) setF((p) => (p.provider ? p : { ...p, provider: r.insurance!.provider, plan: r.insurance!.plan || '', member_no: r.insurance!.member_no || '', valid_until: r.insurance!.valid_until || '', notes: r.insurance!.coverage_notes || '' }));
    } catch (e: any) { setError(e?.message || 'Could not load your record.'); setRec((r) => r ?? { allergies: [], labs: [], radiology: [], immunisations: [], insurance: null, visits: [], open_visit: null, dependents: [] }); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['records.update', 'notification.new']);
  const onRefresh = usePull(load, setRefreshing);

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true); setFe(null);
    try { await fn(); done?.(); await load(); } catch (e: any) { setFe(e?.message || 'That did not save. Please check the entry.'); } finally { setBusy(false); }
  };
  const confirm = (title: string, ok: () => void) => Alert.alert(title, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: ok }]);

  const sendCode = async (s: RecShare) => {
    try { await Share.share({ message: `HEWAL3 record code: ${s.code}. It works for a limited time. Enter it in the doctor website to see my shared record.` }); } catch { /* closed */ }
  };

  return (
    <ProtectedRoute>
      <View style={{ flex: 1, backgroundColor: C.background }}>
        <GlassBackdrop />
        <Screen bg="transparent" header={<ScreenHeader title="Health record" subtitle="Allergies, results, imaging and visits" onBack={() => router.back()} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 14, paddingBottom: 60 }}>
          {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
          {!rec ? <><Skeleton height={120} /><Skeleton height={160} /></> : (
            <>
              <Glass radius={24} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={pc?.doctor?.name || 'Doctor'} size={48} photo={pc?.doctor?.photo_url} />
                  <View style={{ flex: 1 }}>
                    <T v="caption" color={C.textSecondary}>Your primary care doctor</T>
                    <T v="heading">{pc?.doctor ? pc.doctor.name : 'Not linked yet'}</T>
                    {pc?.doctor ? <T v="caption" color={C.textSecondary}>{[pc.doctor.specialization, pc.doctor.hospital].filter(Boolean).join(', ')}</T> : null}
                  </View>
                </View>
                {pc?.doctor ? (
                  <View style={{ marginTop: 10, gap: 4 }}>
                    <T v="caption">{pc.next_appointment ? `Next visit: ${new Date(pc.next_appointment.starts_at as string).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : pc.pending_requests ? `${pc.pending_requests} appointment request${pc.pending_requests > 1 ? 's' : ''} waiting for an answer` : 'No visit booked'}</T>
                    {pc.last_visit ? <T v="caption" color={C.textSecondary}>Last visit: {day(pc.last_visit.checked_out_at)}</T> : null}
                  </View>
                ) : <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>Link your doctor so they can follow your health and you can book visits.</T>}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  {pc?.doctor ? <Button title="Book a visit" icon="calendar-outline" style={{ flex: 1 }} onPress={() => router.push('/(patient)/doctor-appointments' as any)} /> : null}
                  {pc?.doctor ? <Button title="Message" icon="chatbubble-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/(patient)/doctor-chat' as any)} /> : <Button title="Link my doctor" icon="medkit-outline" style={{ flex: 1 }} onPress={() => router.push('/(patient)/my-doctor' as any)} />}
                </View>
              </Glass>

              {rec.open_visit ? <Banner tone="info" title="You are checked in" text={`${rec.open_visit.facility || 'Clinic'}${rec.open_visit.reason ? `, ${rec.open_visit.reason}` : ''}. Checked in ${day(rec.open_visit.checked_in_at)}.`} icon="business-outline" /> : null}

              <Block icon="shield-outline" title="Allergies" onAdd={() => { setForm(form === 'allergy' ? null : 'allergy'); setFe(null); }}>
                {form === 'allergy' ? (
                  <View style={{ gap: 8, marginBottom: 8 }}>
                    <TextField label="Allergic to" value={f.substance} onChangeText={set('substance')} placeholder="For example penicillin" maxLength={120} />
                    <TextField label="Reaction (optional)" value={f.reaction} onChangeText={set('reaction')} maxLength={200} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>{['mild', 'moderate', 'severe'].map((s) => <Chip key={s} label={s} selected={f.severity === s} onPress={() => set('severity')(s)} />)}</View>
                    {fe ? <T v="caption" color={C.danger}>{fe}</T> : null}
                    <Button title="Save allergy" loading={busy} disabled={!f.substance.trim()} onPress={() => run(() => addAllergy({ substance: f.substance.trim(), reaction: f.reaction.trim() || undefined, severity: f.severity }), () => { setForm(null); setF((p) => ({ ...p, substance: '', reaction: '', severity: 'mild' })); })} />
                  </View>
                ) : null}
                {rec.allergies.length === 0 ? <T v="caption" color={C.textSecondary}>None recorded. Add any allergy so every doctor sees it.</T> : rec.allergies.map((a) => (
                  <Row key={a.id} title={a.substance} sub={[a.reaction, a.source === 'doctor' ? 'Added by a doctor' : 'Added by you'].filter(Boolean).join(', ')} right={<Badge label={a.severity} tone={SEV_TONE[a.severity]} />}
                    onRemove={a.source === 'patient' ? () => confirm(`Remove ${a.substance}?`, () => run(() => deleteAllergy(a.id))) : undefined} label={`Remove ${a.substance}`} />
                ))}
              </Block>

              <Block icon="flask-outline" title="Test results">
                {rec.labs.length === 0 ? <T v="caption" color={C.textSecondary}>No results yet. Your doctor adds them here, and you are told when they do.</T> : rec.labs.map((l) => (
                  <Row key={l.id} title={`${l.test}: ${l.value}${l.unit ? ` ${l.unit}` : ''}`} sub={[l.ref_range && `Normal ${l.ref_range}`, day(l.taken_at)].filter(Boolean).join(', ')} right={<Badge label={l.flag} tone={FLAG_TONE[l.flag]} />} />
                ))}
              </Block>

              <Block icon="scan-outline" title="Imaging reports">
                {rec.radiology.length === 0 ? <T v="caption" color={C.textSecondary}>No imaging reports yet.</T> : rec.radiology.map((x) => (
                  <Row key={x.id} title={`${MODALITY[x.modality] || x.modality}, ${x.body_part}`} sub={[x.impression, [x.facility, day(x.performed_at)].filter(Boolean).join(', ')].filter(Boolean).join('\n')}
                    right={x.image_url ? <Pressable accessibilityRole="link" accessibilityLabel="Open the image" onPress={() => import('expo-web-browser').then((m) => m.openBrowserAsync(x.image_url!)).catch(() => {})} hitSlop={10}><Ionicons name="open-outline" size={20} color={C.primary} /></Pressable> : null} />
                ))}
              </Block>

              <Block icon="bandage-outline" title="Vaccinations" onAdd={() => { setForm(form === 'vaccine' ? null : 'vaccine'); setFe(null); }}>
                {form === 'vaccine' ? (
                  <View style={{ gap: 8, marginBottom: 8 }}>
                    <TextField label="Vaccine" value={f.vaccine} onChangeText={set('vaccine')} maxLength={120} />
                    <TextField label="Dose (optional)" value={f.dose} onChangeText={set('dose')} placeholder="For example booster" maxLength={30} />
                    <TextField label="Date given (year-month-day)" value={f.given_on} onChangeText={set('given_on')} placeholder="2025-03-01" maxLength={10} autoCapitalize="none" />
                    {fe ? <T v="caption" color={C.danger}>{fe}</T> : null}
                    <Button title="Save vaccination" loading={busy} disabled={!f.vaccine.trim()} onPress={() => run(() => addImmunisation({ vaccine: f.vaccine.trim(), dose: f.dose.trim() || undefined, given_on: f.given_on }), () => { setForm(null); setF((p) => ({ ...p, vaccine: '', dose: '', given_on: today() })); })} />
                  </View>
                ) : null}
                {rec.immunisations.length === 0 ? <T v="caption" color={C.textSecondary}>No vaccinations recorded.</T> : rec.immunisations.map((i) => (
                  <Row key={i.id} title={`${i.vaccine}${i.dose ? `, ${i.dose}` : ''}`} sub={[day(i.given_on), i.facility, i.source === 'doctor' ? 'Added by a doctor' : 'Added by you'].filter(Boolean).join(', ')}
                    onRemove={i.source === 'patient' ? () => confirm(`Remove ${i.vaccine}?`, () => run(() => deleteImmunisation(i.id))) : undefined} label={`Remove ${i.vaccine}`} />
                ))}
              </Block>

              <Block icon="card-outline" title="Health insurance" onAdd={() => { setForm(form === 'insurance' ? null : 'insurance'); setFe(null); }}>
                {form === 'insurance' ? (
                  <View style={{ gap: 8, marginBottom: 8 }}>
                    <TextField label="Insurance company" value={f.provider} onChangeText={set('provider')} maxLength={120} />
                    <TextField label="Plan (optional)" value={f.plan} onChangeText={set('plan')} maxLength={120} />
                    <TextField label="Member number (optional)" value={f.member_no} onChangeText={set('member_no')} maxLength={60} autoCapitalize="characters" />
                    <TextField label="Valid until (year-month-day, optional)" value={f.valid_until} onChangeText={set('valid_until')} placeholder="2027-01-31" maxLength={10} autoCapitalize="none" />
                    <TextField label="Notes from your card (optional)" value={f.notes} onChangeText={set('notes')} maxLength={400} multiline />
                    {fe ? <T v="caption" color={C.danger}>{fe}</T> : null}
                    <Button title="Save insurance" loading={busy} disabled={!f.provider.trim()} onPress={() => run(() => saveInsurance({ provider: f.provider.trim(), plan: f.plan.trim() || undefined, member_no: f.member_no.trim() || undefined, valid_until: f.valid_until.trim() || undefined, coverage_notes: f.notes.trim() || undefined }), () => setForm(null))} />
                  </View>
                ) : null}
                {rec.insurance ? (
                  <Row title={`${rec.insurance.provider}${rec.insurance.plan ? `, ${rec.insurance.plan}` : ''}`}
                    sub={[rec.insurance.member_no && `Member ${rec.insurance.member_no}`, rec.insurance.valid_until && `${rec.insurance.expired ? 'Expired' : 'Valid until'} ${day(rec.insurance.valid_until)}`, rec.insurance.coverage_notes].filter(Boolean).join('\n')}
                    right={rec.insurance.expired ? <Badge label="Expired" tone="danger" /> : <Badge label="Active" tone="success" />} onRemove={() => confirm('Remove your insurance details?', () => run(() => deleteInsurance()))} label="Remove insurance" />
                ) : <T v="caption" color={C.textSecondary}>Add your insurance so you have it at hand. You enter it from your own card.</T>}
              </Block>

              <Block icon="business-outline" title="Visits">
                {rec.visits.length === 0 ? <T v="caption" color={C.textSecondary}>No visits yet. When a clinic checks you in and out, it shows here.</T> : rec.visits.map((v) => (
                  <Row key={v.id} title={`${v.kind === 'emergency' ? 'Emergency' : v.kind === 'admission' ? 'Admission' : 'Clinic visit'}${v.reason ? `, ${v.reason}` : ''}`}
                    sub={[v.facility, v.doctor, `${day(v.checked_in_at)}${v.checked_out_at ? ` to ${day(v.checked_out_at)}` : ''}`, v.summary].filter(Boolean).join('\n')} right={v.open ? <Badge label="In now" tone="info" /> : null} />
                ))}
              </Block>

              <Block icon="share-social-outline" title="Share with another clinic">
                <T v="caption" color={C.textSecondary} style={{ marginBottom: 8 }}>Give a short code to a clinic or hospital. It shows them this record only, for a limited time, and you can cancel it any time. You see who used it.</T>
                <TextField label="Who is it for (optional)" value={f.label} onChangeText={set('label')} placeholder="For example City Hospital" maxLength={120} />
                <Button title="Create a code for 24 hours" icon="key-outline" loading={busy} style={{ marginTop: 8 }} onPress={() => run(async () => { setFresh(await createShare(f.label.trim(), 24)); })} />
                {fresh?.code ? (
                  <View style={{ marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', gap: 6 }}>
                    <T v="caption" color={C.textSecondary}>Your code (shown once)</T>
                    <T v="display" style={{ letterSpacing: 4, fontSize: 28, fontVariant: ['tabular-nums'] }} selectable>{fresh.code}</T>
                    <Button title="Send it" variant="secondary" icon="share-outline" onPress={() => sendCode(fresh)} />
                  </View>
                ) : null}
                {shares.map((s) => (
                  <Row key={s.id} title={s.label || 'Shared record'} sub={`${s.revoked ? 'Cancelled' : s.active ? `Until ${day(s.expires_at)}` : 'Ended'}, used ${s.uses} of ${s.max_uses}${s.accessed_by.length ? `\n${s.accessed_by.map((a) => `${a.doctor}, ${day(a.at)}`).join('\n')}` : ''}`}
                    right={s.active ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel this code" onPress={() => run(() => revokeShare(s.id))} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}><T v="label" color={C.danger}>Cancel</T></Pressable> : null} />
                ))}
              </Block>

              <T v="caption" color={C.textSecondary} style={{ textAlign: 'center' }}>HEWAL3 supports care and does not diagnose. Only you and the doctor you linked can see this record.</T>
            </>
          )}
        </Screen>
      </View>
    </ProtectedRoute>
  );
}
