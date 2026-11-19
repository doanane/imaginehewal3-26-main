import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Banner, Button, Chip, EmptyState, Screen, ScreenHeader, Skeleton, T, TextField } from '../../components/ui';
import { Glass, GlassBackdrop } from '../../components/ui/Glass';
import { Ionicons, Pressable, View } from '../../components/themed';
import { theme } from '../../constants/theme';
import { addDependentEntry, DepEntry, deleteDependent, deleteDependentEntry, getDependentEntries, getDependents, RecDependent, saveDependent } from '../../services/api';

const C = theme.COLORS;
const RELATIONS = ['child', 'parent', 'spouse', 'other'];
const blank = { name: '', relationship: 'child', birth_date: '', sex: '', allergies: '', conditions: '', notes: '' };
const ageOf = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00'); const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a -= 1;
  return a >= 0 ? a : null;
};


const KIND_LABEL: Record<string, string> = { vaccine: 'Vaccine', result: 'Result', visit: 'Visit' };
const ICON: Record<string, 'bandage-outline' | 'flask-outline' | 'medkit-outline'> = { vaccine: 'bandage-outline', result: 'flask-outline', visit: 'medkit-outline' };
const dayOf = (iso: string | null) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const todayIso = () => new Date().toISOString().slice(0, 10);

/** A family member's own record: vaccines, results and visits you enter yourself. */
function DepRecords({ dep }: { dep: RecDependent }) {
  const [rows, setRows] = useState<DepEntry[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ kind: 'vaccine', title: '', detail: '', on_date: todayIso() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { getDependentEntries(dep.id).then((r) => setRows(r.entries)).catch((e) => { setErr(e?.message || 'Could not load.'); setRows([]); }); }, [dep.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const save = async () => {
    setBusy(true); setErr(null);
    try { await addDependentEntry(dep.id, { kind: f.kind, title: f.title.trim(), detail: f.detail.trim() || undefined, on_date: f.on_date }); setAdding(false); setF({ kind: 'vaccine', title: '', detail: '', on_date: todayIso() }); load(); }
    catch (e: any) { setErr(e?.message || 'That did not save. Please check the entry.'); } finally { setBusy(false); }
  };
  return (
    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.borderLight, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="bodyStrong">{dep.name.split(' ')[0]}'s record</T>
        <Pressable onPress={() => { setAdding((a) => !a); setErr(null); }} accessibilityRole="button" accessibilityLabel={`Add to the record of ${dep.name}`} hitSlop={10} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={adding ? 'close-circle' : 'add-circle'} size={28} color={C.primary} />
        </Pressable>
      </View>
      {adding ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>{['vaccine', 'result', 'visit'].map((k) => <Chip key={k} label={KIND_LABEL[k]} selected={f.kind === k} onPress={() => setF((p) => ({ ...p, kind: k }))} />)}</View>
          <TextField label={f.kind === 'vaccine' ? 'Vaccine' : f.kind === 'result' ? 'Test' : 'Reason for the visit'} value={f.title} onChangeText={(v) => setF((p) => ({ ...p, title: v }))} maxLength={120} />
          <TextField label="Details (optional)" value={f.detail} onChangeText={(v) => setF((p) => ({ ...p, detail: v }))} maxLength={400} />
          <TextField label="Date (year-month-day)" value={f.on_date} onChangeText={(v) => setF((p) => ({ ...p, on_date: v }))} maxLength={10} autoCapitalize="none" />
          {err ? <T v="caption" color={C.danger}>{err}</T> : null}
          <Button title="Save" loading={busy} disabled={!f.title.trim()} onPress={save} />
        </View>
      ) : null}
      {!rows ? <Skeleton height={40} /> : rows.length === 0 && !adding ? <T v="caption" color={C.textSecondary}>Nothing yet. Add a vaccine, a result or a visit.</T> : rows.map((e) => (
        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Ionicons name={ICON[e.kind]} size={18} color={C.primary} />
          <View style={{ flex: 1 }}><T v="bodyStrong">{e.title}</T><T v="caption" color={C.textSecondary}>{[KIND_LABEL[e.kind], dayOf(e.on_date), e.detail].filter(Boolean).join(', ')}</T></View>
          <Pressable onPress={() => deleteDependentEntry(dep.id, e.id).then(load).catch(() => {})} accessibilityRole="button" accessibilityLabel={`Remove ${e.title}`} hitSlop={10} style={{ minHeight: 44, minWidth: 36, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={16} color={C.textSecondary} /></Pressable>
        </View>
      ))}
    </View>
  );
}

/** Family profiles: a child, a parent or a partner you look after. Only you can see them. */
export default function Dependents() {
  const router = useRouter();
  const [list, setList] = useState<RecDependent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [fe, setFe] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setList((await getDependents()).dependents); setError(null); } catch (e: any) { setError(e?.message || 'Could not load.'); setList((l) => l ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const open = (d?: RecDependent) => {
    setFe(null);
    if (d) { setF({ name: d.name, relationship: d.relationship, birth_date: d.birth_date || '', sex: d.sex || '', allergies: d.allergies || '', conditions: d.conditions || '', notes: d.notes || '' }); setEditing(d.id); }
    else { setF(blank); setEditing('new'); }
  };
  const save = async () => {
    setBusy(true); setFe(null);
    try {
      await saveDependent({ name: f.name.trim(), relationship: f.relationship, birth_date: f.birth_date.trim() || undefined, sex: f.sex || undefined, allergies: f.allergies.trim() || undefined, conditions: f.conditions.trim() || undefined, notes: f.notes.trim() || undefined } as any, editing === 'new' ? undefined : (editing as number));
      setEditing(null); await load();
    } catch (e: any) { setFe(e?.message || 'That did not save. Please check the entry.'); } finally { setBusy(false); }
  };
  const remove = (d: RecDependent) => Alert.alert(`Remove ${d.name}?`, 'Their profile is deleted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { try { await deleteDependent(d.id); await load(); } catch (e: any) { setError(e?.message || 'Could not remove.'); } } }]);

  return (
    <ProtectedRoute>
      <View style={{ flex: 1, backgroundColor: C.background }}>
        <GlassBackdrop />
        <Screen bg="transparent" header={<ScreenHeader title="Family profiles" subtitle="People you look after" onBack={() => router.back()} right={editing ? undefined : <Pressable onPress={() => open()} accessibilityRole="button" accessibilityLabel="Add a family member" hitSlop={10} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add-circle" size={30} color={C.primary} /></Pressable>} />}
          contentStyle={{ gap: 14, paddingBottom: 60 }} keyboard>
          {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
          {editing ? (
            <Glass radius={24} style={{ padding: 16, gap: 8 }}>
              <T v="heading">{editing === 'new' ? 'Add a family member' : 'Edit profile'}</T>
              <TextField label="Name" value={f.name} onChangeText={set('name')} maxLength={120} />
              <T v="label" color={C.textSecondary}>Relationship</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{RELATIONS.map((r) => <Chip key={r} label={r} selected={f.relationship === r} onPress={() => set('relationship')(r)} />)}</View>
              <TextField label="Date of birth (year-month-day, optional)" value={f.birth_date} onChangeText={set('birth_date')} placeholder="2019-05-02" maxLength={10} autoCapitalize="none" />
              <View style={{ flexDirection: 'row', gap: 8 }}>{['Female', 'Male'].map((s) => <Chip key={s} label={s} selected={f.sex === s} onPress={() => set('sex')(f.sex === s ? '' : s)} />)}</View>
              <TextField label="Allergies (optional)" value={f.allergies} onChangeText={set('allergies')} maxLength={300} />
              <TextField label="Conditions (optional)" value={f.conditions} onChangeText={set('conditions')} maxLength={300} />
              <TextField label="Notes (optional)" value={f.notes} onChangeText={set('notes')} maxLength={400} multiline />
              {fe ? <T v="caption" color={C.danger}>{fe}</T> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                <Button title="Save" loading={busy} disabled={!f.name.trim()} onPress={save} style={{ flex: 1 }} />
              </View>
            </Glass>
          ) : null}
          {!list ? <Skeleton height={110} /> : list.length === 0 && !editing ? (
            <EmptyState icon="people-outline" title="No family profiles yet" text="Add a child, a parent or a partner to keep their allergies and conditions with you. Only you can see them." action="Add someone" onAction={() => open()} />
          ) : list.map((d) => {
            const age = ageOf(d.birth_date);
            return (
              <Glass key={d.id} radius={24} style={{ padding: 16 }} onPress={() => open(d)} label={`Edit ${d.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={d.name} size={48} />
                  <View style={{ flex: 1 }}>
                    <T v="heading">{d.name}</T>
                    <T v="caption" color={C.textSecondary}>{[d.relationship, age != null ? `${age} years` : null, d.sex].filter(Boolean).join(', ')}</T>
                  </View>
                  <Pressable onPress={() => remove(d)} accessibilityRole="button" accessibilityLabel={`Remove ${d.name}`} hitSlop={10} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={20} color={C.textSecondary} /></Pressable>
                </View>
                {d.allergies ? <T v="caption" style={{ marginTop: 8 }}>Allergies: {d.allergies}</T> : null}
                {d.conditions ? <T v="caption">Conditions: {d.conditions}</T> : null}
                {d.notes ? <T v="caption" color={C.textSecondary}>{d.notes}</T> : null}
                <DepRecords dep={d} />
              </Glass>
            );
          })}
          <T v="caption" color={C.textSecondary} style={{ textAlign: 'center' }}>Family profiles stay private to you. They are not sent to your doctor.</T>
        </Screen>
      </View>
    </ProtectedRoute>
  );
}
