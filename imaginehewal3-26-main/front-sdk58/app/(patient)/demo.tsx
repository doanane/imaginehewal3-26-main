import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Button, Card, Screen, ScreenHeader, Section, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';

const C = theme.COLORS;

/**
 * Demo tools. Shown only when the backend runs in development mode (the server decides, not the app).
 * Each button sends a reading through the same pipeline a real watch uses: detection, caregiver alert, escalation, the doctor's
 * website. Nothing here is faked on the screen.
 */
export default function DemoTools() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getEmergencyConfig().then((c) => setEnabled(!!c.simulation)).catch(() => setEnabled(false)); }, []);

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key); setError(null); setNote(null);
    try { await fn(); api.invalidateApiCache(); setNote('Sent. The caregiver and the doctor website now see it.'); after?.(); }
    catch (e: any) { setError(e?.message || 'Could not send that.'); }
    finally { setBusy(null); }
  };
  const toEmergency = () => router.push('/(patient)/emergency' as any);

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Demo tools" subtitle="For showing the emergency flow" onBack={() => router.back()} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {enabled === false ? <Banner tone="info" text="Demo tools are only available when the server is running in development mode." /> : null}
        {error ? <Banner tone="warning" text={error} /> : null}
        {note ? <Banner tone="success" text={note} /> : null}
        {enabled ? (
          <>
            <Section title="Blood pressure spike">
              <Card>
                <T v="caption" color={C.textSecondary}>Sends a reading of 190/125 mmHg. HEWAL3 flags it, starts the emergency countdown, alerts the caregiver, and if nobody answers it escalates to 112 with your location.</T>
                <Button title="Simulate a blood pressure spike" icon="pulse-outline" loading={busy === 'bp'} style={{ marginTop: 12 }}
                  onPress={() => run('bp', () => api.simulateCriticalVitals({ systolic: 190, diastolic: 125 }), toEmergency)} />
              </Card>
            </Section>
            <Section title="Other spikes">
              <Card style={{ gap: 10 }}>
                <Button title="Heart rate 165 bpm" variant="secondary" loading={busy === 'hr'} onPress={() => run('hr', () => api.simulateCriticalVitals({ heart_rate: 165 }), toEmergency)} />
                <Button title="Blood oxygen 84%" variant="secondary" loading={busy === 'o2'} onPress={() => run('o2', () => api.simulateCriticalVitals({ blood_oxygen: 84 }), toEmergency)} />
              </Card>
            </Section>
            <Section title="Back to normal">
              <Card>
                <T v="caption" color={C.textSecondary}>Sends a calm reading (72 bpm, 118/76, 98%) so the status returns to stable.</T>
                <Button title="Send a normal reading" variant="secondary" icon="checkmark-circle-outline" loading={busy === 'ok'} style={{ marginTop: 12 }}
                  onPress={() => run('ok', () => api.ingestVitals({ device_id: 'demo-watch', device_name: 'Demo watch', heart_rate: 72, blood_oxygen: 98, blood_pressure_systolic: 118, blood_pressure_diastolic: 76 }))} />
              </Card>
            </Section>
          </>
        ) : null}
      </Screen>
    </ProtectedRoute>
  );
}
