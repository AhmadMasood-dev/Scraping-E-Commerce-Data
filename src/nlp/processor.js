/**
 * Unified NLP pipeline. Detects language (English / Roman Urdu / Urdu),
 * transliterates / translates to English, extracts keywords + units, and
 * returns a normalized query suitable for cache keys + DB search.
 *
 * Output shape:
 *   { original, language, translated, keywords, units, normalized }
 */
const compromise = require('compromise');
const logger = require('../config/logger');

// ─── Roman Urdu dictionary (expandable) ─────────────────────────────────────
const romanUrduDict = {
  // intent fillers — drop entirely
  mujhe: '', mujhay: '', chahiye: '', chahye: '', chahyee: '',
  hai: '', hay: '', ka: '', ki: '', ke: '', ko: '', se: '', mein: '', kuch: '',
  // adjectives
  sasta: 'cheap', sastay: 'cheap', sasti: 'cheap',
  mehnga: 'expensive', mehngi: 'expensive', mehngaa: 'expensive',
  acha: 'good', achi: 'good', achay: 'good', achaa: 'good',
  bura: 'bad', buri: 'bad', buray: 'bad',
  naya: 'new', nai: 'new', nayi: 'new',
  purana: 'old', purani: 'old',
  bara: 'big', bari: 'big', barra: 'big',
  chota: 'small', choti: 'small',
  // nouns
  mobile: 'smartphone', mobail: 'smartphone', phone: 'smartphone',
  laptop: 'laptop', computer: 'computer',
  joota: 'shoes', jootay: 'shoes', jootian: 'shoes',
  kapde: 'clothes', kapra: 'clothes', kapray: 'clothes',
  ghari: 'watch', gharian: 'watches',
  ghar: 'house', makaan: 'house', flat: 'flat',
  gari: 'car', gaari: 'car',
  chai: 'tea', cheeni: 'sugar', doodh: 'milk', anda: 'egg', ande: 'eggs',
  pani: 'water', tel: 'oil',
};

const ROMAN_URDU_HINTS = new Set([
  'mujhe', 'chahiye', 'chahye', 'sasta', 'mehnga', 'acha', 'naya', 'kapde',
  'joota', 'ghari', 'mobail', 'gari', 'cheeni', 'doodh', 'pani',
]);

const URDU_RANGE = /[؀-ۿ]/;

const detectLanguage = (text) => {
  if (URDU_RANGE.test(text)) return 'ur';
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = tokens.filter((t) => ROMAN_URDU_HINTS.has(t)).length;
  if (hits >= 1 && tokens.length <= 8) return 'ro';
  // Best-effort franc detection (lightweight import); fallback to en
  try {
    // eslint-disable-next-line global-require
    const { franc } = require('franc-min');
    const code = franc(text, { minLength: 4 });
    if (code === 'urd') return 'ur';
  } catch (_e) {
    // franc-min may not be importable; ignore and default
  }
  return 'en';
};

const transliterate = (text) =>
  text
    .split(/\s+/)
    .map((w) => {
      const k = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (romanUrduDict[k] !== undefined) return romanUrduDict[k];
      return w;
    })
    .filter((w) => w !== '')
    .join(' ')
    .trim();

const translateUrduScript = async (text) => {
  try {
    // eslint-disable-next-line global-require
    const { translate } = require('@vitalets/google-translate-api');
    const result = await translate(text, { to: 'en' });
    return result?.text || text;
  } catch (err) {
    logger.warn(`[NLP] Urdu translation failed (${err.message}); falling back to dictionary`);
    return transliterate(text);
  }
};

const extractKeywords = (englishText) => {
  try {
    const doc = compromise(englishText);
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    const merged = [...new Set([...nouns, ...adjectives].map((w) => w.toLowerCase()).filter(Boolean))];
    return merged.length > 0 ? merged : englishText.toLowerCase().split(/\s+/).filter(Boolean);
  } catch (_e) {
    return englishText.toLowerCase().split(/\s+/).filter(Boolean);
  }
};

const UNIT_REGEX = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|inch|in|gb|tb|mb)/gi;

const extractUnits = (text) => {
  const out = [];
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = UNIT_REGEX.exec(text)) !== null) {
    out.push({ value: parseFloat(match[1]), unit: match[2].toLowerCase() });
  }
  return out;
};

const normalize = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const processQuery = async (raw, langHint) => {
  const original = (raw || '').trim();
  const language = langHint || detectLanguage(original);

  let translated = original;
  if (language === 'ro') {
    translated = transliterate(original);
  } else if (language === 'ur') {
    translated = await translateUrduScript(original);
  }

  const keywords = extractKeywords(translated);
  const units = extractUnits(translated);
  const normalized = normalize(keywords.join(' ') || translated);

  return { original, language, translated, keywords, units, normalized };
};

module.exports = { processQuery, detectLanguage };
