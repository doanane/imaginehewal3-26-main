import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { ReadAloud } from '../../../components/ReadAloud';
import { Badge, Banner, Button, Card, Chip, ListRow, ProgressBar, Screen, ScreenHeader, Section, T, TextField } from '../../../components/ui';
import { Reveal } from '../../../components/ui/motion';
import { theme } from '../../../constants/theme';
import api, { FoodSummary, MealAssessment, MealCoach, MealNutrients } from '../../../services/api';
import { imagePart } from '../../../services/upload';
import { ActivityIndicator, Ionicons, View } from '../../../components/themed';

const C = theme.COLORS;
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const PORTIONS: { key: string; label: string }[] = [{ key: 'small', label: 'Small' }, { key: 'regular', label: 'Regular' }, { key: 'large', label: 'Large' }, { key: 'extra', label: 'Extra large' }];
const defaultMeal = () => { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; };
const TONE = { low: 'success', medium: 'warning', high: 'danger' } as const;
const WORDS = { low: 'Good choice for you', medium: 'Fine in moderation', high: 'Better to limit' } as const;

export default function MealScreen() {
  const router = useRouter();
  const [mealType, setMealType] = useState<string>(defaultMeal());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSummary[]>([]);
  const [candidates, setCandidates] = useState<{ id: string; name: string; confidence: number }[]>([]);
  const [notice, setNotice] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [dish, setDish] = useState<{ id: string; name: string; serving: string } | null>(null);
  const [portion, setPortion] = useState('regular');
  const [detail, setDetail] = useState<{ nutrients: MealNutrients; assessment: MealAssessment; coach: MealCoach } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ calories: number; target: number; percent: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {                                   // debounced search; empty query shows common dishes
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { api.searchFoods(query).then((r) => setResults(r.items)).catch(() => {}); }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  useEffect(() => {
    if (!dish) { setDetail(null); return; }
    api.getFoodDetail(dish.id, portion).then((d) => setDetail({ nutrients: d.nutrients, assessment: d.assessment, coach: d.coach })).catch(() => setDetail(null));
  }, [dish?.id, portion]);

  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', camera ? 'Allow camera access to photograph your meal.' : 'Allow photo access to choose a meal photo.'); return; }
      const res = camera ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ['images'] as any })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] as any });
      if (res.canceled || !res.assets?.[0]) return;
      setAnalysing(true); setCandidates([]); setNotice('');
      const asset = res.assets[0];
      const form = new FormData();
      const up = await imagePart(asset.uri, asset.mimeType);
      form.append('file', up.part, up.name);
      const out = await api.identifyMealPhoto(form);
      setCandidates(out.candidates); setNotice(out.candidates.length ? out.notice : out.note || out.notice);
    } catch (e: any) { setNotice('We could not read that photo. Choose your meal from the list below.'); }
    finally { setAnalysing(false); }
  };

  const save = async () => {
    if (!dish) return;
    setSaving(true);
    try { const r = await api.logMeal(dish.id, portion, mealType); setSaved(r.today); }
    catch (e: any) { Alert.alert('Could not save', e.message); }
    finally { setSaving(false); }
  };

  const summary = detail && dish
    ? `${dish.name}. About ${detail.nutrients.calories} calories. ${WORDS[detail.assessment.warning_level]}. ${detail.assessment.concerns.join('. ')}. ${detail.assessment.advice}`
    : '';

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Log a meal" onBack={() => router.back()} />} keyboard contentStyle={{ paddingBottom: 48 }}>
        {saved ? (
          <Reveal>
            <Card tone="soft" style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Ionicons name="checkmark-circle" size={56} color={C.success} />
              <T v="title" style={{ marginTop: 8 }}>Meal saved</T>
              <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{saved.calories} of about {saved.target} calories today</T>
              <View style={{ alignSelf: 'stretch', marginTop: 12 }}><ProgressBar value={saved.percent / 100} /></View>
              <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 20 }}>
                <Button title="Log another meal" onPress={() => { setSaved(null); setDish(null); setCandidates([]); setQuery(''); }} />
                <Button title="Back to Home" variant="secondary" onPress={() => router.replace('/(patient)/(tabs)/today' as any)} />
              </View>
            </Card>
          </Reveal>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {MEALS.map((m) => <Chip key={m} label={m[0].toUpperCase() + m.slice(1)} selected={mealType === m} onPress={() => setMealType(m)} />)}
            </View>

            <Reveal index={0}>
              <Card>
                <T v="heading">Add a photo</T>
                <T v="caption" color={C.textSecondary} style={{ marginTop: 2, marginBottom: 12 }}>We suggest what it might be. You confirm it.</T>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title="Take photo" icon="camera-outline" onPress={() => pick(true)} style={{ flex: 1 }} disabled={analysing} />
                  <Button title="Choose photo" icon="image-outline" variant="secondary" onPress={() => pick(false)} style={{ flex: 1 }} disabled={analysing} />
                </View>
                {analysing ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}><ActivityIndicator color={C.primary} /><T v="caption" color={C.textSecondary}>Looking at your meal...</T></View> : null}
                {notice ? <View style={{ marginTop: 12 }}><Banner tone="info" text={notice} /></View> : null}
                {candidates.length ? (
                  <View style={{ marginTop: 12 }}>
                    <T v="label" color={C.textSecondary} style={{ marginBottom: 4 }}>Is it one of these?</T>
                    {candidates.map((c) => (
                      <ListRow key={c.id} icon="restaurant-outline" title={c.name} subtitle={`${Math.round(c.confidence * 100)}% match`}
                        onPress={() => { setDish({ id: c.id, name: c.name, serving: '' }); }} />
                    ))}
                  </View>
                ) : null}
              </Card>
            </Reveal>

            <Reveal index={1}>
              <Section title="Or search for your meal">
                <TextField value={query} onChangeText={setQuery} placeholder="Try waakye, banku, fufu, kenkey" autoCapitalize="none" returnKeyType="search" />
                <Card style={{ paddingVertical: 4 }}>
                  {results.length === 0 ? <T v="caption" color={C.textSecondary} style={{ padding: 12 }}>No meals match. Try another name.</T> : results.map((f) => (
                    <ListRow key={f.id} icon="restaurant-outline" title={f.name} subtitle={f.serving} onPress={() => setDish({ id: f.id, name: f.name, serving: f.serving })}
                      right={dish?.id === f.id ? <Ionicons name="checkmark-circle" size={22} color={C.primary} /> : undefined} />
                  ))}
                </Card>
              </Section>
            </Reveal>

            {dish ? (
              <Reveal index={0}>
                <Section title={dish.name}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {PORTIONS.map((p) => <Chip key={p.key} label={p.label} selected={portion === p.key} onPress={() => setPortion(p.key)} />)}
                  </View>
                  {detail ? (
                    <Card>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View><T v="display">{detail.nutrients.calories}</T><T v="caption" color={C.textSecondary}>calories (estimate)</T></View>
                        <Badge label={WORDS[detail.assessment.warning_level]} tone={TONE[detail.assessment.warning_level]} />
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
                        {[['Carbs', detail.nutrients.carbs, 'g'], ['Protein', detail.nutrients.protein, 'g'], ['Fat', detail.nutrients.fat, 'g'], ['Fibre', detail.nutrients.fibre, 'g'], ['Salt', Math.round(detail.nutrients.sodium_mg), 'mg sodium']].map(([k, v, u]) => (
                          <View key={String(k)}><T v="bodyStrong">{v} <T v="caption" color={C.textSecondary}>{u}</T></T><T v="caption" color={C.textSecondary}>{k}</T></View>
                        ))}
                      </View>
                      <View style={{ marginTop: 14 }}><T v="label" color={C.textSecondary}>Meal score for you: {detail.assessment.diet_score} out of 100</T><View style={{ marginTop: 6 }}><ProgressBar value={detail.assessment.diet_score / 100} color={detail.assessment.warning_level === 'low' ? C.success : detail.assessment.warning_level === 'medium' ? C.warning : C.danger} /></View></View>
                      {detail.assessment.concerns.map((c) => <View key={c} style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><Ionicons name="alert-circle-outline" size={18} color={C.warning} /><T v="caption" style={{ flex: 1 }}>{c}</T></View>)}
                      {detail.assessment.positives.map((c) => <View key={c} style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><Ionicons name="checkmark-circle-outline" size={18} color={C.success} /><T v="caption" style={{ flex: 1 }}>{c}</T></View>)}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><Ionicons name="bulb-outline" size={18} color={C.primary} /><T v="caption" style={{ flex: 1 }}>{detail.assessment.advice}</T></View>
                      <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>{detail.assessment.portion_note}</T>
                      <ReadAloud text={summary} />
                    </Card>
                  ) : null}
                  {detail?.coach ? (
                    <Card tone={detail.coach.tone === 'danger' ? 'danger' : 'soft'}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name={detail.coach.tone === 'danger' ? 'warning-outline' : 'sparkles-outline'} size={20} color={detail.coach.tone === 'danger' ? C.danger : C.primary} />
                        <T v="heading" style={{ flex: 1 }}>{detail.coach.headline}</T>
                      </View>
                      <T v="body" style={{ marginTop: 8 }}>{detail.coach.message}</T>
                      {detail.coach.based_on.length ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>Based on your {detail.coach.based_on.join(', ')}.</T> : null}
                      <ReadAloud text={`${detail.coach.headline}. ${detail.coach.message}`} />
                    </Card>
                  ) : <ActivityIndicator color={C.primary} />}
                  <Button title="Save this meal" icon="checkmark" onPress={save} loading={saving} disabled={!detail} style={{ marginTop: 16 }} />
                </Section>
              </Reveal>
            ) : null}
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
