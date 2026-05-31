// Free-text intent parser for the Telegram bot. No LLM: deterministic
// normalization + verb regex + stop-word stripping + fuzzy match (Fuse.js).

import Fuse from 'fuse.js';

// Verb synonyms. Detection uses word-boundary regex; residue extraction uses
// the flat token set so any synonym is stripped from the search query.
const VERBS = {
  on: ['accendi', 'attiva', 'apri'],
  off: ['spegni', 'disattiva', 'togli', 'chiudi', 'stacca'],
  toggle: ['toggle', 'inverti']
};
const ON_RE = /\b(accendi|attiva|apri)\b/;
const OFF_RE = /\b(spegni|disattiva|togli|chiudi|stacca)\b/;
const TOGGLE_RE = /\b(toggle|inverti)\b/;

const VERB_WORDS = new Set([...VERBS.on, ...VERBS.off, ...VERBS.toggle]);

const STOP_WORDS = new Set([
  'luce', 'luci', 'la', 'il', 'lo', 'le', 'gli', 'di', 'del', 'dello',
  'della', 'dell', 'a', 'in', 'su', 'tutte', 'tutti', 'tutto'
]);

// lowercase, strip diacritics (NFD + remove combining marks), squeeze spaces.
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectVerb(normalized) {
  if (TOGGLE_RE.test(normalized)) return 'toggle';
  if (OFF_RE.test(normalized)) return 'off';
  if (ON_RE.test(normalized)) return 'on';
  return null;
}

export function extractResidue(normalized) {
  return normalized
    .split(' ')
    .filter((t) => t && !VERB_WORDS.has(t) && !STOP_WORDS.has(t))
    .join(' ')
    .trim();
}

// Build the fuzzy matchers over the current dataset. Two separate Fuse
// instances so each kind keeps its own keys (lights also match on room_name).
// Threshold is set wide (0.6) so we can surface near-miss *suggestions*; the
// caller enforces the spec's 0.3 / 0.4 cutoffs on the returned scores.
export function buildMatchers(lights, rooms) {
  const lightFuse = new Fuse(lights, {
    keys: ['name', 'room_name'],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true
  });
  const roomFuse = new Fuse(rooms, {
    keys: ['name'],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true
  });
  return { lightFuse, roomFuse };
}

// "tutto / tutti / tutte" (optionally "i dispositivi", "le luci") signals a
// whole-installation command when no specific room/light is meant.
const ALL_RE = /\b(tutto|tutti|tutte)\b/;

// Returns { type:'status' } | { type:'action', verb, residue, all, lightResults, roomResults }
// where *Results are [{ item, score }] sorted ascending by score.
export function parseIntent(text, { lightFuse, roomFuse }) {
  const normalized = normalize(text);
  const verb = detectVerb(normalized);

  if (!verb && (normalized === 'stato' || normalized === 'status')) {
    return { type: 'status' };
  }

  const all = ALL_RE.test(normalized);
  const residue = extractResidue(normalized);
  const lightResults = residue ? lightFuse.search(residue) : [];
  const roomResults = residue ? roomFuse.search(residue) : [];

  return { type: 'action', verb, residue, all, lightResults, roomResults };
}

export { VERBS };
