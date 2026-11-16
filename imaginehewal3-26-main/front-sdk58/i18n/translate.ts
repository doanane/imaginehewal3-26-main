/**
 * Translates the text a screen shows, at the moment it is drawn, from tables of phrases written by hand (never by a machine at run time).
 *
 * - A table maps an English phrase to its translation. A phrase may hold placeholders, `{0}`, `{1}`, for the parts that change
 *   ("{0} days left" -> "{0} jours restants"), so numbers and names inside a sentence still translate.
 * - Text with no entry stays in English. A screen is therefore never half broken, and nothing is guessed.
 * - Health advice is only ever shown in a language when a person who knows it has written that phrase.
 */
import { PHRASES } from './phrases';

type Pattern = { re: RegExp; out: string; weight: number };
type Table = { exact: Map<string, string>; patterns: Pattern[] };
const cache = new Map<string, Table>();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function tableFor(lang: string): Table | null {
  const src = PHRASES[lang];
  if (!src) return null;
  let t = cache.get(lang);
  if (!t) {
    t = { exact: new Map(), patterns: [] };
    for (const [en, out] of Object.entries(src)) {
      if (/\{\d\}/.test(en)) {
        const literal = en.replace(/\{\d\}/g, '');
        const source = '^' + escape(en).replace(/\\\{(\d)\\\}/g, '(.*?)') + '$';
        t.patterns.push({ re: new RegExp(source), out, weight: literal.length });
      } else t.exact.set(en, out);
    }
    t.patterns.sort((a, b) => b.weight - a.weight);          // the most specific sentence wins
    cache.set(lang, t);
  }
  return t;
}

/** The phrase in `lang`, or the same text when there is no entry. Leading and trailing spaces are kept. */
export function translateText(text: string, lang: string, depth = 0): string {
  if (!text || lang === 'en') return text;
  const t = tableFor(lang);
  if (!t) return text;
  const core = text.trim();
  if (!core) return text;
  const lead = text.slice(0, text.indexOf(core)), trail = text.slice(text.indexOf(core) + core.length);
  const hit = t.exact.get(core);
  if (hit !== undefined) return lead + hit + trail;
  for (const p of t.patterns) {
    const m = p.re.exec(core);
    if (m) {
      const out = p.out.replace(/\{(\d)\}/g, (_, i) => {
        const part = m[Number(i) + 1] ?? '';
        return depth < 1 ? translateText(part, lang, depth + 1) : part;          // a piece such as "Heart rate" inside a longer sentence is translated too
      });
      return lead + out + trail;
    }
  }
  return text;
}

type Child = string | number | boolean | null | undefined | object;
/** Children of a Text: a string, or the pieces React makes from `{count} days`. Pieces are joined first so the whole sentence can match. */
export function translateChildren(children: any, lang: string): any {
  if (lang === 'en' || children == null) return children;
  if (typeof children === 'string') return translateText(children, lang);
  if (Array.isArray(children)) {
    const plain = (children as Child[]).every((c) => c == null || typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean');
    if (plain) {
      const joined = (children as Child[]).filter((c) => typeof c === 'string' || typeof c === 'number').join('');
      const out = translateText(joined, lang);
      if (out !== joined) return out;
    }
    return (children as Child[]).map((c) => (typeof c === 'string' ? translateText(c, lang) : c));
  }
  return children;
}

export const hasTable = (lang: string) => !!PHRASES[lang];
