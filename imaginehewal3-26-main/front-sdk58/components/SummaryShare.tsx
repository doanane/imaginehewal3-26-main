import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Alert, Share } from 'react-native';
import { theme } from '../constants/theme';
import api from '../services/api';
import { Button, Card, Section, T } from './ui';
import { Switch, View } from './themed';

const C = theme.COLORS;

/** Builds a one-page summary and hands it to the phone's share sheet, so the patient decides who receives it. */
export default function SummaryShare() {
  const [withWellbeing, setWithWellbeing] = useState(false);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const s = await api.getClinicianSummary(30, withWellbeing);
      try { await Share.share({ title: 'My HEWAL3 health summary', message: s.text }); }
      catch { await Clipboard.setStringAsync(s.text); Alert.alert('Copied', 'Your summary was copied. Paste it into a message or email to your clinician.'); }
    } catch (e: any) { Alert.alert('Could not create the summary', e.message); }
    finally { setBusy(false); }
  };

  return (
    <Section title="Share with your clinician">
      <Card>
        <T v="caption" color={C.textSecondary}>A one-page summary of the last 30 days: heart rate, activity, medicines, meals, risk check and your goals. You choose who receives it.</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <T v="bodyStrong">Include my wellbeing check-in</T>
            <T v="caption" color={C.textSecondary}>Off by default. Only you can turn this on.</T>
          </View>
          <Switch value={withWellbeing} onValueChange={setWithWellbeing} trackColor={{ true: C.primary, false: C.border }} accessibilityLabel="Include my wellbeing check-in" />
        </View>
        <Button title="Create and share summary" icon="share-outline" onPress={share} loading={busy} style={{ marginTop: 14 }} />
      </Card>
    </Section>
  );
}
