import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ago, usePull, useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Section, Skeleton, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { CareNoteItem, CareTeam } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

/** The care team and the shared care log for one patient. The patient reads it; an approved caregiver also writes to it.
 *  Everything comes from the server, so what a caregiver writes reaches the patient and the other caregivers at once. */
export default function CareLog() {
  const router = useRouter();
  const { patientId, name } = useLocalSearchParams<{ patientId: string; name?: string }>();
  const pid = Number(patientId);
  const [team, setTeam] = useState<CareTeam | null>(null);
  const [notes, setNotes] = useState<CareNoteItem[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, n] = await Promise.all([api.getCareTeam(pid), api.getCareNotes(pid)]);
      setTeam(t); setNotes(n.notes); setCanWrite(n.can_write); setError(null);
    } catch (e: any) { setError(e?.message || 'Could not load the care log.'); setNotes((x) => x ?? []); }
  }, [pid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['care_note.new', 'presence']);
  const onRefresh = usePull(load, setRefreshing);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try { await api.addCareNote(pid, body); setText(''); await load(); }
    catch (e: any) { setError(e?.message || 'Could not save the note.'); }
    finally { setBusy(false); }
  };
  const remove = (n: CareNoteItem) => Alert.alert('Delete this note?', 'It is removed for everyone on the care team.', [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.deleteCareNote(n.id); await load(); } catch (e: any) { setError(e?.message || 'Could not delete.'); } } },
  ]);

  const who = team?.patient.name || name || 'Care log';
  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Care log" subtitle={who} onBack={() => router.back()} />} keyboard
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}

        <Section title="Care team">
          {!team ? <Skeleton height={80} /> : (
            <>
              {team.doctor ? (
                <Card style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={team.doctor.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyStrong" numberOfLines={1}>{team.doctor.name}</T>
                      <T v="caption" color={C.textSecondary} numberOfLines={1}>{['Doctor', team.doctor.specialization, team.doctor.hospital].filter(Boolean).join(', ')}</T>
                    </View>
                  </View>
                </Card>
              ) : null}
              {team.caregivers.map((c) => (
                <Card key={c.id} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={c.name} online={c.online} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyStrong" numberOfLines={1}>{c.me ? `${c.name} (you)` : c.name}</T>
                      <T v="caption" color={C.textSecondary} numberOfLines={1}>{['Caregiver', c.type, c.relationship].filter(Boolean).join(', ')}</T>
                    </View>
                  </View>
                </Card>
              ))}
              {!team.doctor && team.caregivers.length === 0 ? <EmptyState icon="people-outline" title="No one else yet" text="Caregivers the patient approves, and a linked doctor, appear here." /> : null}
            </>
          )}
        </Section>

        <Section title="Notes">
          {canWrite ? (
            <Card style={{ marginBottom: 10 }}>
              <TextField label="Add a note for the care team" value={text} onChangeText={setText} maxLength={2000} multiline placeholder="What happened today, what to watch for" />
              <View style={{ marginTop: 10 }}><Button title="Save note" icon="create-outline" loading={busy} disabled={!text.trim()} onPress={add} /></View>
              <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>The patient and the other caregivers can read this.</T>
            </Card>
          ) : null}
          {notes === null ? <Skeleton height={80} /> : notes.length === 0 ? (
            <EmptyState icon="document-text-outline" title="No notes yet" text={canWrite ? 'Write the first note above.' : 'Notes from your caregivers appear here.'} />
          ) : notes.map((n) => (
            <Card key={n.id} style={{ marginBottom: 8 }}>
              <T v="body">{n.text}</T>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <T v="caption" color={C.textTertiary}>{`${n.author}, ${ago(n.at)}`}</T>
                {n.mine ? <T v="caption" color={C.danger} onPress={() => remove(n)} accessibilityRole="button" accessibilityLabel="Delete this note">Delete</T> : null}
              </View>
            </Card>
          ))}
        </Section>
      </Screen>
    </ProtectedRoute>
  );
}
