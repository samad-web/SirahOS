/**
 * Simple in-memory cache with TTL support.
 * No external dependencies — lightweight and fast.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Purge expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.purge(), 60_000);
    this.cleanupInterval.unref(); // Don't prevent process exit
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  /** Invalidate a specific key */
  del(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate all keys matching a prefix */
  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Remove all expired entries */
  private purge(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  /** Get-or-set pattern: returns cached value or calls fn and caches result */
  async getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const data = await fn();
    this.set(key, data, ttlSeconds);
    return data;
  }

  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const cache = new MemoryCache();

// TTL presets (in seconds)
export const TTL = {
  SHORT: 30,         // 30 seconds — for fast-changing data
  MEDIUM: 5 * 60,    // 5 minutes — reports, summaries
  LONG: 15 * 60,     // 15 minutes — filters, reference data
  LEADS: 2 * 60,     // 2 minutes — external Supabase data
} as const;
