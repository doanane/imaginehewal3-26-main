import React from 'react';
import { theme } from '../../constants/theme';
import type { Article, ChallengeCard, CommunityReview, InterestGroup, ReviewsResult } from '../../services/api';
import { Badge, Card, T } from '../ui';
import { AmbientOrb, DepthSurface, ProgressRing } from '../ui/motion';
import { Ionicons, View } from '../themed';

const C = theme.COLORS;
export const GOLD = '#F5A623';

export const bandColor = (band: string | null) => (band === 'Excellent' || band === 'Good' ? C.success : band === 'Fair' ? C.warning : band ? C.danger : C.textTertiary);
export const shortDate = (iso: string | null) => (iso ? new Date(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Five stars: gold when filled, outlined when empty. Half stars show for averages. */
export function Stars({ value, size = 16, gap = 2 }: { value: number; size?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap }} accessibilityRole="image" accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'} size={size} color={GOLD} />)}
    </View>
  );
}

/** One review as a card: title and date on one line, the stars under the title, the reviewer's name under the date, then the words. */
export function ReviewCard({ r }: { r: CommunityReview }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.borderLight, padding: 16, ...theme.SHADOWS.small }}
      accessible accessibilityLabel={`${r.rating} stars. ${r.title}. By ${r.author}. ${r.body}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T v="heading" numberOfLines={2}>{r.title}</T>
          <View style={{ marginTop: 6 }}><Stars value={r.rating} size={15} /></View>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: '40%' }}>
          <T v="caption" color={C.textSecondary}>{shortDate(r.created_at)}</T>
          <T v="caption" color={C.textSecondary} numberOfLines={1} style={{ marginTop: 6 }}>{r.mine ? `${r.author} (you)` : r.author}</T>
        </View>
      </View>
      <T v="body" style={{ marginTop: 12 }}>{r.body}</T>
      {r.edited ? <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>Edited</T> : null}
    </View>
  );
}

/** The average, the number of reviews and how many gave each rating. */
export function RatingSummary({ data }: { data: ReviewsResult }) {
  const max = Math.max(1, ...Object.values(data.distribution));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <View style={{ alignItems: 'center', minWidth: 84 }}>
          <T v="display" style={{ fontSize: 44, lineHeight: 50 }}>{data.average != null ? data.average.toFixed(1) : '--'}</T>
          <T v="caption" color={C.textSecondary}>out of 5</T>
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          {['5', '4', '3', '2', '1'].map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T v="caption" color={C.textSecondary} style={{ width: 10 }}>{k}</T>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.borderLight, overflow: 'hidden' }}>
                <View style={{ width: `${((data.distribution[k] || 0) / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: GOLD }} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{data.count} {data.count === 1 ? 'review' : 'reviews'} from people using HEWAL3</T>
    </Card>
  );
}

/** The wellbeing score as a ring, with its word and what it is based on. */
export function ScoreHero({ score, band, parts, onPress }: { score: number | null; band: string | null; parts: number; onPress: () => void }) {
  const col = bandColor(band);
  return (
    <DepthSurface label={score != null ? `Wellbeing score ${score}, ${band}. Open details` : 'Wellbeing score. Not enough data yet. Open details'} onPress={onPress}
      style={{ backgroundColor: C.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.borderLight, overflow: 'hidden', ...theme.SHADOWS.small }}>
      <AmbientOrb size={150} color={`${col}22`} style={{ position: 'absolute', right: -40, top: -40 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <ProgressRing value={score ?? 0} size={104} stroke={11} color={col} track={`${col}26`}>
          <T v="title" style={{ fontSize: 30, lineHeight: 36 }}>{score ?? '--'}</T>
        </ProgressRing>
        <View style={{ flex: 1 }}>
          <T v="label" color={C.textSecondary}>Wellbeing score</T>
          <T v="heading" color={col} style={{ marginTop: 2 }}>{band ?? 'Not enough data yet'}</T>
          <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>
            {score != null ? `Built from ${parts} of 5 areas of your own data. See how it is calculated.` : 'Add data from two areas to see your score.'}
          </T>
        </View>
        <Ionicons name="chevron-forward" size={20} color={C.textTertiary} />
      </View>
    </DepthSurface>
  );
}

export function ChallengeTile({ c, onPress, wide }: { c: ChallengeCard; onPress: () => void; wide?: boolean }) {
  const pct = c.joined ? c.percent ?? 0 : 0;
  return (
    <DepthSurface label={`${c.title}, ${c.joined ? `${pct} percent done` : 'not joined'}. ${c.days_left} days left`} onPress={onPress}
      style={{ width: wide ? '100%' : 210, backgroundColor: C.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.borderLight, ...theme.SHADOWS.small }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={c.icon as any} size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyStrong" numberOfLines={1}>{c.title}</T>
          <T v="caption" color={C.textSecondary}>{c.domain}</T>
        </View>
        {c.done ? <Ionicons name="checkmark-circle" size={22} color={C.success} /> : null}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.borderLight, marginTop: 14, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: c.done ? C.success : C.primary }} />
      </View>
      <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>
        {c.joined ? `${(c.value ?? 0).toLocaleString()} of ${c.target.toLocaleString()} ${c.unit}` : `${c.target.toLocaleString()} ${c.unit} this week`}
      </T>
      <T v="caption" color={c.joined ? C.primary : C.textTertiary} style={{ marginTop: 2, fontWeight: '600' }}>{c.joined ? `${c.days_left} ${c.days_left === 1 ? 'day' : 'days'} left` : 'Tap to join'}</T>
    </DepthSurface>
  );
}

export function GroupTile({ g, onPress }: { g: InterestGroup; onPress: () => void }) {
  return (
    <DepthSurface label={`${g.title}, ${g.joined ? 'joined' : 'not joined'}`} onPress={onPress}
      style={{ width: '100%', backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.borderLight, minHeight: 112 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={g.icon as any} size={19} color={C.primary} />
      </View>
      <T v="bodyStrong" numberOfLines={2} style={{ marginTop: 10 }}>{g.title}</T>
      <T v="caption" color={g.joined ? C.success : C.textSecondary} style={{ marginTop: 2, fontWeight: g.joined ? '600' : '400' }}>
        {g.joined ? 'Joined' : g.members ? `${g.members} members` : 'New group'}
      </T>
    </DepthSurface>
  );
}

const CAT_ICON: Record<string, string> = { physical: 'barbell-outline', mental: 'happy-outline', nutrition: 'nutrition-outline', sleep: 'moon-outline' };
export function ArticleRow({ a, onPress }: { a: Article; onPress: () => void }) {
  return (
    <DepthSurface label={`${a.title}. ${a.category_label}. ${a.minutes} minute read`} onPress={onPress}
      style={{ backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.borderLight, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={(CAT_ICON[a.category] || 'book-outline') as any} size={22} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyStrong" numberOfLines={2}>{a.title}</T>
          <T v="caption" color={C.textSecondary} numberOfLines={2} style={{ marginTop: 2 }}>{a.summary}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Badge label={a.category_label} tone="info" />
            <T v="caption" color={C.textTertiary}>{a.minutes} min read</T>
            {a.read ? <Ionicons name="checkmark-circle" size={15} color={C.success} /> : null}
          </View>
        </View>
        {a.saved ? <Ionicons name="bookmark" size={18} color={C.primary} /> : null}
      </View>
    </DepthSurface>
  );
}
