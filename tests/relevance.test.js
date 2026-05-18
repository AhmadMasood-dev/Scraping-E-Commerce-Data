const { scoreItem, rankAndCap } = require('../src/scrapers/utils/relevance');

describe('relevance scorer', () => {
  test('on-topic title outranks off-topic title', () => {
    const onTopic  = { title: 'iPhone 15 Pro Max 256GB', rating: 4.6 };
    const offTopic = { title: 'Replacement Cable for iPhone', rating: 3.2 };
    const kws = ['iphone', '15'];
    expect(scoreItem(onTopic, kws)).toBeGreaterThan(scoreItem(offTopic, kws));
  });

  test('rankAndCap caps at topN and rewrites position by rank', () => {
    const items = Array.from({ length: 50 }).map((_, i) => ({
      title: i % 2 === 0 ? `iPhone 15 variant #${i}` : `Random gadget #${i}`,
      rating: Math.random() * 5,
    }));
    const ranked = rankAndCap(items, ['iphone', '15'], 20);
    expect(ranked).toHaveLength(20);
    // position 0 = highest score
    expect(ranked[0].position).toBe(0);
    expect(ranked[19].position).toBe(19);
    // scores must be monotonically non-increasing
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]._score).toBeGreaterThanOrEqual(ranked[i]._score);
    }
  });

  test('missing query keywords still produces deterministic order', () => {
    const items = [{ title: 'A', rating: 5 }, { title: 'B', rating: 1 }];
    const ranked = rankAndCap(items, [], 10);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].title).toBe('A');  // higher rating wins
  });
});
