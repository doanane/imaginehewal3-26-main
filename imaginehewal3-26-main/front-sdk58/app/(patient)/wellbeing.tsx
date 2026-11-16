import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { ReadAloud } from '../../components/ReadAloud';
import { Badge, Banner, Button, Card, IconName, ProgressBar, Screen, ScreenHeader, Section, T } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { EMERGENCY_NUMBER } from '../../constants/behavior';
import { theme } from '../../constants/theme';
import api, { WellbeingQuestionnaire, WellbeingResult, WellbeingSummary } from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;
const ICON: Record<string, IconName> = { urgent: 'alert-circle', primary_care: 'medkit-outline', community: 'people-outline', self_help: 'leaf-outline' };
const BAND = { low: { tone: 'success', label: 'No concern right now' }, elevated: { tone: 'warning', label: 'Worth talking to someone' }, high: { tone: 'danger', label: 'Please get support soon' } } as const;
const TREND = { improving: 'Getting better than your recent check-ins', steady: 'About the same as your recent check-ins', worsening: 'A little higher than your recent check-ins' } as const;

export default function Wellbeing() {
  const router = useRouter();
  const [q, setQ] = useState<WellbeingQuestionnaire | null>(null);
  const [history, setHistory] = useState<WellbeingSummary | null>(null);
  const [step, setStep] = useState(-1);                 // -1 intro, 0..3 questions, 4 safety, 5 result
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<WellbeingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getWellbeingQuestionnaire().then(setQ).catch(() => setError('Could not load the questions. Check your connection.'));
    api.getWellbeingSummary().then(setHistory).catch(() => {});
  }, []);

  const choose = (value: number) => { setAnswers((a) => [...a.slice(0, step), value]); setStep((s) => s + 1); };

  const submit = async (safety: boolean) => {
    setBusy(true); setError(null);
    try { const r = await api.submitWellbeing(answers, safety); setResult(r); setStep(5); }
    catch (e: any) { setError(e.message || 'Could not save your check-in.'); }
    finally { setBusy(false); }
  };

  const askTeam = async () => {
    try { const r = await api.askCareTeamForSupport(); setAsked(r.message); }
    catch (e: any) { Alert.alert('Could not send', e.message); }
  };

  const spoken = result ? `${result.headline}. ${result.next_steps.map((s) => `${s.title}. ${s.text}`).join(' ')}` : '';

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Wellbeing check-in" onBack={() => router.back()} />} contentStyle={{ paddingBottom: 48 }}>
        {error ? <View style={{ marginBottom: 12 }}><Banner tone="danger" text={error} /></View> : null}

        {step === -1 ? (
          <Reveal>
            <Card>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="happy-outline" size={30} color={C.primary} /></View>
              <T v="title" style={{ marginTop: 14 }}>How have you been feeling?</T>
              <T v="body" color={C.textSecondary} style={{ marginTop: 6 }}>Four short questions, about one minute. Your mood and stress affect your health and your habits, so it helps to check in once a week.</T>
              <View style={{ gap: 8, marginTop: 14 }}>
                {['Your answers are private to you. Your care team cannot see them.', 'This is a screening questionnaire, not a diagnosis.', 'You decide whether to ask anyone for support.'].map((x) => (
                  <View key={x} style={{ flexDirection: 'row', gap: 10 }}><Ionicons name="lock-closed-outline" size={18} color={C.primary} style={{ marginTop: 2 }} /><T v="caption" style={{ flex: 1 }}>{x}</T></View>
                ))}
              </View>
              <Button title="Start" icon="arrow-forward" onPress={() => setStep(0)} disabled={!q} style={{ marginTop: 18 }} />
            </Card>
            {history && history.history.length ? (
              <Section title="Your recent check-ins">
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 70 }} accessibilityLabel="Recent wellbeing scores, lower is better">
                    {history.history.map((h) => <View key={h.id} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 14, height: 6 + (h.total / 12) * 56, borderRadius: 4, backgroundColor: h.total >= 6 ? C.danger : h.total >= 3 ? C.warning : C.success }} /></View>)}
                  </View>
                  {history.trend ? <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{TREND[history.trend as keyof typeof TREND]}</T> : null}
                  {history.link ? <T v="caption" color={C.primary} style={{ marginTop: 6 }}>{history.link}</T> : null}
                  <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>Lower bars are better.</T>
                </Card>
              </Section>
            ) : null}
          </Reveal>
        ) : null}

        {q && step >= 0 && step <= 3 ? (
          <Reveal key={step}>
            <ProgressBar value={(step + 1) / 5} />
            <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>Question {step + 1} of 5</T>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 14 }}>{q.stem}</T>
            <T v="title" style={{ marginTop: 6, marginBottom: 18 }}>{q.items[step].text}</T>
            <View style={{ gap: 10 }}>
              {q.options.map((o) => <Button key={o.value} title={o.label} variant="secondary" onPress={() => choose(o.value)} style={{ minHeight: 60 }} />)}
            </View>
            {step > 0 ? <Button title="Back" variant="ghost" onPress={() => setStep((s) => s - 1)} style={{ marginTop: 12 }} /> : null}
          </Reveal>
        ) : null}

        {q && step === 4 ? (
          <Reveal>
            <ProgressBar value={1} />
            <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>Question 5 of 5</T>
            <T v="title" style={{ marginTop: 14, marginBottom: 6 }}>{q.safety_question}</T>
            <T v="caption" color={C.textSecondary} style={{ marginBottom: 18 }}>This one is not scored. It helps us make sure you get the right help.</T>
            <View style={{ gap: 10 }}>
              <Button title="No" variant="secondary" onPress={() => submit(false)} loading={busy} style={{ minHeight: 60 }} />
              <Button title="Yes" variant="secondary" onPress={() => submit(true)} disabled={busy} style={{ minHeight: 60 }} />
            </View>
          </Reveal>
        ) : null}

        {result && step === 5 ? (
          <Reveal>
            {result.crisis ? (
              <Card tone="danger" style={{ marginBottom: 14 }}>
                <T v="heading" color={C.danger}>You deserve support right now</T>
                <T v="caption" color={C.textPrimary} style={{ marginTop: 4, marginBottom: 12 }}>Please call for help, or tell someone you trust how you feel. You do not have to face this alone.</T>
                <Button title={`Call ${EMERGENCY_NUMBER}`} icon="call" variant="danger" onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)} />
                <Button title="Ask my care team to check in" icon="people-outline" variant="secondary" onPress={askTeam} style={{ marginTop: 10 }} />
                {asked ? <T v="caption" color={C.textPrimary} style={{ marginTop: 8 }}>{asked}</T> : null}
              </Card>
            ) : null}

            <Card>
              <Badge label={BAND[result.band].label} tone={BAND[result.band].tone} />
              <T v="title" style={{ marginTop: 10 }}>{result.headline}</T>
              <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>Mood score {result.phq2} of 6. Worry score {result.gad2} of 6. A score of 3 or more on either is the usual sign that talking to a professional is worthwhile.</T>
              <ReadAloud text={spoken} />
            </Card>

            <Section title="What you can do">
              {result.next_steps.filter((s) => !(result.crisis && s.level === 'urgent')).map((s) => (
                <Card key={s.level} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={ICON[s.level] ?? 'leaf-outline'} size={22} color={C.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong">{s.title}</T>
                      <T v="caption" color={C.textSecondary} style={{ marginTop: 2 }}>{s.text}</T>
                      <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>Why: {s.eligibility}</T>
                    </View>
                  </View>
                </Card>
              ))}
            </Section>

            {!result.crisis && result.screen_positive ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                <Button title="Ask my care team to check in" icon="people-outline" onPress={askTeam} />
                {asked ? <T v="caption" color={C.textSecondary}>{asked}</T> : null}
                <T v="caption" color={C.textTertiary}>This sends a request only. Your answers are not shared.</T>
              </View>
            ) : null}
            <Button title="Talk to the assistant" icon="sparkles-outline" variant="secondary" onPress={() => router.replace('/(patient)/(tabs)/assistant' as any)} style={{ marginTop: 12 }} />
            <Button title="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: 6 }} />
            <T v="caption" color={C.textTertiary} style={{ marginTop: 10, textAlign: 'center' }}>{result.disclaimer}</T>
          </Reveal>
        ) : null}
      </Screen>
    </ProtectedRoute>
  );
}
