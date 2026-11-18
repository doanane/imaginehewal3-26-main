import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform } from 'react-native';
import { theme } from '../constants/theme';
import { Button, Chip, T } from './ui';
import { Ionicons, Pressable, View } from './themed';

const C = theme.COLORS;
const pad = (n: number) => String(n).padStart(2, '0');

/** "14:41" -> a Date today at that time (the picker needs a Date). */
export const toDate = (hhmm?: string | null): Date => {
  const d = new Date();
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
};
export const toHHMM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** "14:41" -> "2:41 pm". */
export const fmt12 = (hhmm?: string | null): string => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * Pick any time, with the phone's own time wheel. Nothing is suggested: the person chooses the exact hour and minute.
 * iPhone shows the wheel in a sheet with Cancel and Done; Android shows its clock dialog.
 */
export function TimeField({ value, onChange, placeholder = 'Choose a time', label }: {
  value?: string | null; onChange: (hhmm: string) => void; placeholder?: string; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(toDate(value));
  const show = () => { setTemp(toDate(value)); setOpen(true); };
  const ios = Platform.OS === 'ios';

  return (
    <View>
      {label ? <T v="label" color={C.textSecondary} style={{ marginBottom: 6 }}>{label}</T> : null}
      <Pressable onPress={show} accessibilityRole="button" accessibilityLabel={`${label || placeholder}${value ? `, ${fmt12(value)}` : ''}`}
        style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="time-outline" size={20} color={C.primary} />
        <T v="bodyStrong" color={value ? C.textPrimary : C.textSecondary} style={{ flex: 1 }}>{value ? fmt12(value) : placeholder}</T>
        <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
      </Pressable>

      {open && !ios ? (
        <DateTimePicker value={temp} mode="time" display="default" is24Hour={false}
          onChange={(e, d) => { setOpen(false); if (e.type === 'set' && d) onChange(toHHMM(d)); }} />
      ) : null}

      {ios ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 28 }}>
              <DateTimePicker value={temp} mode="time" display="spinner" is24Hour={false} onChange={(_e, d) => { if (d) setTemp(d); }} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
                <Button title="Done" onPress={() => { setOpen(false); onChange(toHHMM(temp)); }} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

/** Several times of day (for example the times a medicine is taken): the person adds each one with the wheel and taps one to remove it. */
export function TimeList({ times, onChange, addLabel = 'Add a time', hint = 'Tap a time to remove it' }: {
  times: string[]; onChange: (times: string[]) => void; addLabel?: string; hint?: string;
}) {
  const add = (t: string) => { if (!times.includes(t)) onChange([...times, t].sort()); };
  return (
    <View style={{ gap: 10 }}>
      {times.length ? (
        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {times.map((t) => <Chip key={t} label={fmt12(t)} selected onPress={() => onChange(times.filter((x) => x !== t))} />)}
          </View>
          <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{hint}</T>
        </View>
      ) : null}
      <TimeField value={null} placeholder={addLabel} onChange={add} />
    </View>
  );
}
