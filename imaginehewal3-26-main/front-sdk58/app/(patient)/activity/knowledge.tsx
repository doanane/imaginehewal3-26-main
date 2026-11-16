import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Banner, Badge, Card, Screen, ScreenHeader, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api from '../../../services/api';
import { Pressable, View } from '../../../components/themed';

const C = theme.COLORS;
type Item = { id: string; title: string; topic: string; summary: string; body: string[] };

export default function Knowledge() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.getKnowledge().then((r) => { setItems(r.items); setNote(r.note); }).catch((e) => setErr(e.message || 'Could not load.')); }, []);

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Health knowledge" subtitle="Short, trusted guidance" onBack={() => router.back()} />} contentStyle={{ paddingBottom: 48 }}>
        {err ? <Banner tone="danger" text={err} /> : null}
        <View style={{ gap: 12 }}>
          {items.map((it) => {
            const on = open === it.id;
            return (
              <Pressable key={it.id} onPress={() => setOpen(on ? null : it.id)} accessibilityRole="button" accessibilityState={{ expanded: on }}>
                <Card>
                  <Badge label={it.topic} tone="info" />
                  <T v="heading" style={{ marginTop: 8 }}>{it.title}</T>
                  <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{it.summary}</T>
                  {on ? <View style={{ marginTop: 10, gap: 8 }}>{it.body.map((p, i) => <T key={i} v="body">{p}</T>)}</View> : <T v="label" color={C.primary} style={{ marginTop: 8 }}>Read more</T>}
                </Card>
              </Pressable>
            );
          })}
        </View>
        {note ? <T v="caption" color={C.textTertiary} style={{ marginTop: 16 }}>{note}</T> : null}
      </Screen>
    </ProtectedRoute>
  );
}
