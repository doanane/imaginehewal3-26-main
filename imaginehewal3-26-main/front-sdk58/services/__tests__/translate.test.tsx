import { ALL_ROWS, PHRASES } from '../../i18n/phrases';
import { translateChildren, translateText } from '../../i18n/translate';

test('English is never changed', () => {
  expect(translateText('Sign in', 'en')).toBe('Sign in');
  expect(translateChildren(['3', ' days left'], 'en')).toEqual(['3', ' days left']);
});

test('a phrase is translated exactly, and spaces around it are kept', () => {
  expect(translateText('Sign in', 'fr')).toBe('Se connecter');
  expect(translateText('Sign in', 'ar')).toBe('تسجيل الدخول');
  expect(translateText('  Sign in ', 'fr')).toBe('  Se connecter ');
});

test('text that is not in a table stays in English instead of being guessed', () => {
  expect(translateText('Some brand new sentence nobody translated', 'fr')).toBe('Some brand new sentence nobody translated');
  expect(translateText('Sign in', 'ha')).toBe('Sign in');                           // Hausa has no table yet
});

test('numbers and names inside a sentence are kept and the sentence still translates', () => {
  expect(translateText('3 days left', 'fr')).toBe('3 jours restants');
  expect(translateText('Good morning, Kofi', 'fr')).toBe('Bonjour, Kofi');
  expect(translateText('Good morning, Kofi', 'ar')).toBe('صباح الخير، Kofi');
  expect(translateText('12 min read', 'fr')).toBe('12 min de lecture');
  expect(translateText('Question 2 of 4', 'fr')).toBe('Question 2 sur 4');
});

test('a translated piece inside a longer sentence is translated too', () => {
  expect(translateText('About Heart rate', 'fr')).toBe('À propos : Fréquence cardiaque');
});

test('the most specific pattern wins', () => {
  expect(translateText('Good morning, Kofi', 'tw')).toBe('Mema wo akye, Kofi');
});

test('React splits {count} days into pieces; they are joined first so the whole sentence matches', () => {
  expect(translateChildren(['5', ' days left'], 'fr')).toBe('5 jours restants');
  expect(translateChildren([5, ' days left'], 'fr')).toBe('5 jours restants');
  expect(translateChildren('Sign in', 'fr')).toBe('Se connecter');
  expect(translateChildren(null, 'fr')).toBeNull();
});

test('nested elements are left alone, plain pieces beside them are translated', () => {
  const el = { type: 'b' };
  expect(translateChildren(['Sign in', el], 'fr')).toEqual(['Se connecter', el]);
});

// ---- the tables themselves ----------------------------------------------------------------------------------------------------------
// a plural "s" hole (message{1}) may be left out, because Arabic and French do not add an s the same way
const holes = (s: string) => (s.replace(/(?<=[A-Za-z)])\{\d\}(?=[\s.]|$)/g, '').match(/\{\d\}/g) || []).sort().join(',');
const SAME_IS_FINE = new Set(['OK', 'Apple', 'Google', 'HUAWEI Health', 'Version 3.0.0', 'Nutrition', 'Cardio', 'Total', 'Message', 'Messages', 'Notifications', 'Distance', 'Description', 'Type', 'Diabetes', 'Steps', 'Calories', 'Medication', 'Spam', 'Score', 'Pause', 'Urgent', 'Moderate', 'Patient', 'Patient *', 'Video', 'Instagram', 'Facebook', 'Twitter', 'HEWAL3', 'SpO2', 'Gallery', 'Camera', 'Date', 'Message {0}',
  'bpm', 'Discussion', 'Discussions', 'Cals', 'Cancelled', 'Stable', 'Critique', 'Points', 'Badges', 'Score {0}', '{0} min', '{0} kcal', 'Version 3.0.0', 'Cal', 'Planning', 'Chat', 'Confirmed', 'Contact', 'Connecting', 'Distance (km)', 'calories', 'Navigation', 'Vision', 'Assistant', 'Article', 'Mental', 'Excellent', 'Normal', 'Notes', 'Consultation', 'Conversations', 'Apple Health']);

test('every row has a French and an Arabic translation', () => {
  const missing = ALL_ROWS.filter((r) => !r[1].trim() || !r[2].trim()).map((r) => r[0]);
  expect(missing).toEqual([]);
});

test('a translation keeps exactly the same {0} {1} placeholders as its English', () => {
  const bad = ALL_ROWS.filter((r) => holes(r[0]) !== holes(r[1]) || holes(r[0]) !== holes(r[2])).map((r) => r[0]);
  expect(bad).toEqual([]);
});

test('the same English phrase is never given two different translations', () => {
  const seen = new Map<string, string>();
  const clash: string[] = [];
  for (const [en, fr, ar] of ALL_ROWS) {
    const k = `${fr}|${ar}`;
    if (seen.has(en) && seen.get(en) !== k) clash.push(en);
    seen.set(en, k);
  }
  expect(clash).toEqual([]);
});

test('a row is not just the English copied over (except names and words that are the same in the language)', () => {
  const copied = ALL_ROWS.filter((r) => r[1] === r[0] && !SAME_IS_FINE.has(r[0]) && /[a-z]{4,}/.test(r[0])).map((r) => r[0]);
  expect(copied).toEqual([]);
});

test('Arabic rows contain Arabic script, except for names and codes', () => {
  const latinOnly = ALL_ROWS.filter((r) => !/[؀-ۿ]/.test(r[2]) && !SAME_IS_FINE.has(r[0]) && !/^[\d{}\s.,:%/+()-]+$/.test(r[0])).map((r) => r[0]);
  expect(latinOnly).toEqual([]);
});

test('the tables are big enough to cover the app', () => {
  expect(Object.keys(PHRASES.fr).length).toBeGreaterThan(1200);
  expect(Object.keys(PHRASES.ar).length).toBe(Object.keys(PHRASES.fr).length);
});
