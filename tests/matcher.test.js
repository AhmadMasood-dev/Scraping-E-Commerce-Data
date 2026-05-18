const { group, normalizeKey } = require('../src/scrapers/utils/productMatcher');

describe('productMatcher', () => {
  test('groups similar titles together', () => {
    const items = [
      { title: 'iPhone 15 Pro Max 256GB' },
      { title: 'iPhone 15 Pro Max 256 GB' },
      { title: 'iPhone 15 Pro Max - Blue 256GB' },
      { title: 'Samsung Galaxy S24 Ultra' },
    ];
    const groups = group(items);
    expect(groups.length).toBeLessThanOrEqual(2);
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });

  test('keeps very different titles in their own groups', () => {
    const items = [
      { title: 'iPhone 15' },
      { title: 'Toyota Corolla' },
      { title: 'Sugar 1kg' },
    ];
    const groups = group(items);
    expect(groups.length).toBe(3);
  });

  test('normalizeKey strips punctuation and folds case', () => {
    expect(normalizeKey('iPhone 15 — Pro/Max!')).toBe('iphone 15 promax');
  });
});
