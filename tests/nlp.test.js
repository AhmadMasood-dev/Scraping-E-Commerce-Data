const { processQuery, detectLanguage } = require('../src/nlp/processor');

describe('NLP processor', () => {
  test('detects Roman Urdu', () => {
    expect(detectLanguage('mujhe sasta mobile chahiye')).toBe('ro');
  });

  test('falls back to English', () => {
    expect(detectLanguage('cheap smartphone')).toBe('en');
  });

  test('transliterates Roman Urdu to English keywords', async () => {
    const r = await processQuery('mujhe sasta mobile chahiye', 'ro');
    expect(r.translated.toLowerCase()).toContain('cheap');
    expect(r.translated.toLowerCase()).toContain('smartphone');
    expect(r.normalized).not.toContain('mujhe');
    expect(r.normalized).not.toContain('chahiye');
  });

  test('extracts unit quantities', async () => {
    const r = await processQuery('1kg sugar', 'en');
    expect(r.units).toEqual(expect.arrayContaining([{ value: 1, unit: 'kg' }]));
  });
});
