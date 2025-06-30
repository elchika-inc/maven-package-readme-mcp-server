import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService } from '../../src/services/cache.js';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create cache with default options', () => {
      cacheService = new CacheService();
      const stats = cacheService.getStats();
      
      expect(stats.maxSize).toBe(100);
    });

    it('should create cache with custom options', () => {
      cacheService = new CacheService({ ttl: 5000, maxSize: 50 });
      const stats = cacheService.getStats();
      
      expect(stats.maxSize).toBe(50);
    });
  });

  describe('set and get', () => {
    beforeEach(() => {
      cacheService = new CacheService({ ttl: 1000, maxSize: 3 });
    });

    it('should store and retrieve data', () => {
      // Arrange
      const key = 'test-key';
      const data = { message: 'test data' };

      // Act
      cacheService.set(key, data);
      const result = cacheService.get(key);

      // Assert
      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      // Act
      const result = cacheService.get('non-existent');

      // Assert
      expect(result).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      // Arrange
      const key = 'expiring-key';
      const data = 'expiring data';
      cacheService.set(key, data, 50); // 50ms TTL

      // Act - immediately should return data
      expect(cacheService.get(key)).toBe(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // Assert - should be expired
      expect(cacheService.get(key)).toBeNull();
    });

    it('should handle custom TTL per entry', () => {
      // Arrange
      const key1 = 'key1';
      const key2 = 'key2';
      const data1 = 'data1';
      const data2 = 'data2';

      // Act
      cacheService.set(key1, data1, 500);
      cacheService.set(key2, data2, 1500);

      // Assert
      expect(cacheService.get(key1)).toBe(data1);
      expect(cacheService.get(key2)).toBe(data2);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      cacheService = new CacheService({ ttl: 1000 });
    });

    it('should return true for existing non-expired entry', () => {
      // Arrange
      cacheService.set('existing-key', 'data');

      // Act & Assert
      expect(cacheService.has('existing-key')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      // Act & Assert
      expect(cacheService.has('non-existent')).toBe(false);
    });

    it('should return false for expired entry', async () => {
      // Arrange
      cacheService.set('expiring-key', 'data', 50);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // Act & Assert
      expect(cacheService.has('expiring-key')).toBe(false);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should delete existing entry and return true', () => {
      // Arrange
      cacheService.set('to-delete', 'data');

      // Act
      const deleted = cacheService.delete('to-delete');

      // Assert
      expect(deleted).toBe(true);
      expect(cacheService.get('to-delete')).toBeNull();
    });

    it('should return false for non-existent entry', () => {
      // Act
      const deleted = cacheService.delete('non-existent');

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should clear all entries', () => {
      // Arrange
      cacheService.set('key1', 'data1');
      cacheService.set('key2', 'data2');

      // Act
      cacheService.clear();

      // Assert
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBeNull();
      expect(cacheService.getStats().size).toBe(0);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      cacheService = new CacheService({ ttl: 100 });
    });

    it('should remove expired entries', async () => {
      // Arrange
      cacheService.set('expired-key', 'expired-data', 50);
      cacheService.set('valid-key', 'valid-data', 1000);

      // Wait for one entry to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Act
      cacheService.cleanup();

      // Assert
      expect(cacheService.get('expired-key')).toBeNull();
      expect(cacheService.get('valid-key')).toBe('valid-data');
    });

    it('should handle empty cache cleanup', () => {
      // Act & Assert - should not throw
      expect(() => cacheService.cleanup()).not.toThrow();
    });
  });

  describe('maxSize behavior', () => {
    beforeEach(() => {
      cacheService = new CacheService({ maxSize: 2, ttl: 10000 });
    });

    it('should remove oldest entry when maxSize is reached', () => {
      // Arrange - fill cache to max
      cacheService.set('key1', 'data1');
      cacheService.set('key2', 'data2');

      // Act - add one more entry
      cacheService.set('key3', 'data3');

      // Assert - oldest should be removed
      expect(cacheService.get('key1')).toBeNull();
      expect(cacheService.get('key2')).toBe('data2');
      expect(cacheService.get('key3')).toBe('data3');
    });

    it('should prefer cleanup over removing oldest entry', async () => {
      // Arrange - add expired entry and valid entry
      cacheService.set('expired-key', 'expired-data', 50);
      cacheService.set('valid-key', 'valid-data');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      // Act - add new entry, should cleanup expired first
      cacheService.set('new-key', 'new-data');

      // Assert - expired should be cleaned up, valid entries should remain
      expect(cacheService.get('expired-key')).toBeNull();
      expect(cacheService.get('valid-key')).toBe('valid-data');
      expect(cacheService.get('new-key')).toBe('new-data');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      cacheService = new CacheService({ maxSize: 5 });
    });

    it('should return correct cache statistics', () => {
      // Arrange
      cacheService.set('key1', 'data1');
      cacheService.set('key2', 'data2');

      // Act
      const stats = cacheService.getStats();

      // Assert
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });
  });

  describe('static key generators', () => {
    it('should generate package info key', () => {
      // Act
      const key = CacheService.generatePackageInfoKey('com.example', 'my-artifact', '1.0.0');

      // Assert
      expect(key).toBe('pkg_info:com.example:my-artifact:1.0.0');
    });

    it('should generate package info key with default version', () => {
      // Act
      const key = CacheService.generatePackageInfoKey('com.example', 'my-artifact');

      // Assert
      expect(key).toBe('pkg_info:com.example:my-artifact:latest');
    });

    it('should generate package readme key', () => {
      // Act
      const key = CacheService.generatePackageReadmeKey('com.example', 'my-artifact', '1.0.0');

      // Assert
      expect(key).toBe('pkg_readme:com.example:my-artifact:1.0.0');
    });

    it('should generate search key with all parameters', () => {
      // Act
      const key = CacheService.generateSearchKey('spring boot', 10, 0.8, 0.6);

      // Assert
      expect(key).toMatch(/^search:[a-zA-Z0-9]+$/);
      expect(key.length).toBeGreaterThan('search:'.length);
    });

    it('should generate search key with default parameters', () => {
      // Act
      const key = CacheService.generateSearchKey('spring boot');

      // Assert
      expect(key).toMatch(/^search:[a-zA-Z0-9]+$/);
    });

    it('should generate consistent search keys for same parameters', () => {
      // Act
      const key1 = CacheService.generateSearchKey('spring boot', 10, 0.8, 0.6);
      const key2 = CacheService.generateSearchKey('spring boot', 10, 0.8, 0.6);

      // Assert
      expect(key1).toBe(key2);
    });

    it('should generate different search keys for different parameters', () => {
      // Act
      const key1 = CacheService.generateSearchKey('spring boot', 10);
      const key2 = CacheService.generateSearchKey('different query', 10);
      const key3 = CacheService.generateSearchKey('spring boot', 10, 0.5);

      // Assert - Different parameters should generate different keys
      expect(key1).not.toBe(key2); // Different query
      expect(key1).not.toBe(key3); // Different quality
      expect(key2).not.toBe(key3); // Both different
    });

    it('should generate versions key', () => {
      // Act
      const key = CacheService.generateVersionsKey('com.example', 'my-artifact');

      // Assert
      expect(key).toBe('versions:com.example:my-artifact');
    });

    it('should generate POM key', () => {
      // Act
      const key = CacheService.generatePomKey('com.example', 'my-artifact', '1.0.0');

      // Assert
      expect(key).toBe('pom:com.example:my-artifact:1.0.0');
    });

    it('should generate package exists key', () => {
      // Act
      const key = CacheService.generatePackageExistsKey('com.example', 'my-artifact');

      // Assert
      expect(key).toBe('pkg_exists:com.example:my-artifact');
    });
  });

  describe('type safety', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should handle different data types', () => {
      // Arrange
      const stringData = 'string data';
      const numberData = 42;
      const objectData = { key: 'value', nested: { data: true } };
      const arrayData = [1, 2, 3, 'four'];

      // Act
      cacheService.set('string', stringData);
      cacheService.set('number', numberData);
      cacheService.set('object', objectData);
      cacheService.set('array', arrayData);

      // Assert
      expect(cacheService.get('string')).toBe(stringData);
      expect(cacheService.get('number')).toBe(numberData);
      expect(cacheService.get('object')).toEqual(objectData);
      expect(cacheService.get('array')).toEqual(arrayData);
    });

    it('should handle null and undefined values', () => {
      // Act
      cacheService.set('null-value', null);
      cacheService.set('undefined-value', undefined);

      // Assert
      expect(cacheService.get('null-value')).toBeNull();
      expect(cacheService.get('undefined-value')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      cacheService = new CacheService({ ttl: 1000, maxSize: 1 });
    });

    it('should handle setting same key multiple times', () => {
      // Arrange
      const key = 'same-key';

      // Act
      cacheService.set(key, 'value1');
      cacheService.set(key, 'value2');

      // Assert
      expect(cacheService.get(key)).toBe('value2');
      expect(cacheService.getStats().size).toBe(1);
    });

    it('should handle empty string keys', () => {
      // Act
      cacheService.set('', 'empty key data');

      // Assert
      expect(cacheService.get('')).toBe('empty key data');
    });

    it('should handle concurrent access patterns', () => {
      // Arrange - simulate rapid access
      const key = 'concurrent-key';
      cacheService.set(key, 'data');

      // Act - multiple rapid accesses
      const results = Array.from({ length: 10 }, () => cacheService.get(key));

      // Assert
      results.forEach(result => {
        expect(result).toBe('data');
      });
    });
  });
});