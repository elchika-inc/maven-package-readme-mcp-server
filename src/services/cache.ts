import { CacheEntry, CacheOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTtl = options.ttl ?? 3600000; // 1 hour default
    this.maxSize = options.maxSize ?? 100; // 100 entries default
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    };

    // Remove expired entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
      
      // If still full after cleanup, remove oldest entry
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
          logger.debug('Removed oldest cache entry', { key: oldestKey });
        }
      }
    }

    this.cache.set(key, entry as CacheEntry<unknown>);
    logger.debug('Cache set', { key, ttl: entry.ttl });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      logger.debug('Cache expired', { key, age: now - entry.timestamp, ttl: entry.ttl });
      return null;
    }

    logger.debug('Cache hit', { key, age: now - entry.timestamp });
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache deleted', { key });
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { previousSize: size });
  }

  cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug('Cache cleanup', { removedCount, remainingCount: this.cache.size });
    }
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  // Cache key generators
  static generatePackageInfoKey(groupId: string, artifactId: string, version?: string): string {
    return `pkg_info:${groupId}:${artifactId}:${version ?? 'latest'}`;
  }

  static generatePackageReadmeKey(groupId: string, artifactId: string, version?: string): string {
    return `pkg_readme:${groupId}:${artifactId}:${version ?? 'latest'}`;
  }

  static generateSearchKey(query: string, limit?: number, quality?: number, popularity?: number): string {
    const params = [
      query,
      limit?.toString() ?? '20',
      quality?.toString() ?? 'any',
      popularity?.toString() ?? 'any'
    ].join(':');
    
    // Create a hash of the search parameters for cache key
    const hash = Buffer.from(params, 'utf8').toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    return `search:${hash}`;
  }

  static generateVersionsKey(groupId: string, artifactId: string): string {
    return `versions:${groupId}:${artifactId}`;
  }

  static generatePomKey(groupId: string, artifactId: string, version: string): string {
    return `pom:${groupId}:${artifactId}:${version}`;
  }

  static generatePackageExistsKey(groupId: string, artifactId: string): string {
    return `pkg_exists:${groupId}:${artifactId}`;
  }
}

// Global cache instance
export const cache = new CacheService({
  ttl: parseInt(process.env.CACHE_TTL ?? '3600000', 10), // 1 hour default
  maxSize: parseInt(process.env.CACHE_MAX_SIZE ?? '100', 10),
});