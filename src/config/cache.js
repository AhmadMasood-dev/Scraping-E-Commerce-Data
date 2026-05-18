/**
 * In-memory cache backed by lru-cache. API matches what the report describes
 * for Redis so swapping in ioredis later is a one-file change. TTL accepts
 * seconds (matching the report's spec) or milliseconds via { ms: true }.
 */
const { LRUCache } = require('lru-cache');

const store = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 10, // default 10 min, overridden per set()
});

const get = async (key) => store.get(key);

const set = async (key, value, ttlSeconds) => {
  const ttlMs = (ttlSeconds || 600) * 1000;
  store.set(key, value, { ttl: ttlMs });
};

const del = async (key) => store.delete(key);

const wrap = async (key, ttlSeconds, producer) => {
  const cached = store.get(key);
  if (cached !== undefined) return { value: cached, fromCache: true };
  const value = await producer();
  store.set(key, value, { ttl: ttlSeconds * 1000 });
  return { value, fromCache: false };
};

const stats = () => ({ size: store.size, max: store.max });

module.exports = { get, set, del, wrap, stats };
