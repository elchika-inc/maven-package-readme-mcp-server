import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VersionResolver } from '../../src/services/version-resolver.js';
import { VersionNotFoundError } from '../../src/types/index.js';

// Mock maven-central-api
vi.mock('../../src/services/maven-central-api.js', async () => {
  return {
    mavenCentralApi: {
      getLatestVersion: vi.fn(),
      versionExists: vi.fn(),
      getVersions: vi.fn(),
    },
  };
});

const { mavenCentralApi } = await import('../../src/services/maven-central-api.js');

describe('VersionResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveVersion', () => {
    const groupId = 'com.example';
    const artifactId = 'test-artifact';

    it('should resolve "latest" version', async () => {
      // Arrange
      const latestVersion = '2.1.0';
      vi.mocked(mavenCentralApi.getLatestVersion).mockResolvedValue(latestVersion);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId, 'latest');

      // Assert
      expect(result).toBe(latestVersion);
      expect(mavenCentralApi.getLatestVersion).toHaveBeenCalledWith(groupId, artifactId);
    });

    it('should resolve empty version to latest', async () => {
      // Arrange
      const latestVersion = '2.1.0';
      vi.mocked(mavenCentralApi.getLatestVersion).mockResolvedValue(latestVersion);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId);

      // Assert
      expect(result).toBe(latestVersion);
      expect(mavenCentralApi.getLatestVersion).toHaveBeenCalledWith(groupId, artifactId);
    });

    it('should resolve specific version when it exists', async () => {
      // Arrange
      const specificVersion = '1.5.0';
      vi.mocked(mavenCentralApi.versionExists).mockResolvedValue(true);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId, specificVersion);

      // Assert
      expect(result).toBe(specificVersion);
      expect(mavenCentralApi.versionExists).toHaveBeenCalledWith(groupId, artifactId, specificVersion);
    });

    it('should throw VersionNotFoundError when specific version does not exist', async () => {
      // Arrange
      const specificVersion = '1.5.0';
      vi.mocked(mavenCentralApi.versionExists).mockResolvedValue(false);

      // Act & Assert
      await expect(
        VersionResolver.resolveVersion(groupId, artifactId, specificVersion)
      ).rejects.toThrow(VersionNotFoundError);
      expect(mavenCentralApi.versionExists).toHaveBeenCalledWith(groupId, artifactId, specificVersion);
    });

    it('should resolve version range', async () => {
      // Arrange
      const versionRange = '[1.0,2.0)';
      const availableVersions = ['1.9.0', '1.8.0', '1.5.0', '1.0.0', '0.9.0'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(availableVersions);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId, versionRange);

      // Assert
      expect(result).toBe('1.9.0');
      expect(mavenCentralApi.getVersions).toHaveBeenCalledWith(groupId, artifactId);
    });

    it('should throw VersionNotFoundError when version range has no matches', async () => {
      // Arrange
      const versionRange = '[3.0,4.0)';
      const availableVersions = ['1.9.0', '1.8.0', '1.5.0'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(availableVersions);

      // Act & Assert
      await expect(
        VersionResolver.resolveVersion(groupId, artifactId, versionRange)
      ).rejects.toThrow(VersionNotFoundError);
    });

    it('should handle unknown version specification as literal', async () => {
      // Arrange
      const unknownVersion = 'custom-version';
      vi.mocked(mavenCentralApi.versionExists).mockResolvedValue(true);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId, unknownVersion);

      // Assert
      expect(result).toBe(unknownVersion);
      expect(mavenCentralApi.versionExists).toHaveBeenCalledWith(groupId, artifactId, unknownVersion);
    });

    it('should throw VersionNotFoundError for unknown version specification that does not exist', async () => {
      // Arrange
      const unknownVersion = 'custom-version';
      vi.mocked(mavenCentralApi.versionExists).mockResolvedValue(false);

      // Act & Assert
      await expect(
        VersionResolver.resolveVersion(groupId, artifactId, unknownVersion)
      ).rejects.toThrow(VersionNotFoundError);
    });
  });

  describe('isSpecificVersion', () => {
    it('should recognize simple version numbers', () => {
      // Act & Assert
      expect(VersionResolver['isSpecificVersion']('1.0.0')).toBe(true);
      expect(VersionResolver['isSpecificVersion']('2.1')).toBe(true);
      expect(VersionResolver['isSpecificVersion']('1')).toBe(true);
    });

    it('should recognize snapshot versions', () => {
      // Act & Assert
      expect(VersionResolver['isSpecificVersion']('1.0.0-SNAPSHOT')).toBe(true);
      expect(VersionResolver['isSpecificVersion']('2.1-alpha-1')).toBe(true);
      expect(VersionResolver['isSpecificVersion']('1.0-beta')).toBe(true);
    });

    it('should not recognize version ranges', () => {
      // Act & Assert
      expect(VersionResolver['isSpecificVersion']('[1.0,2.0)')).toBe(false);
      expect(VersionResolver['isSpecificVersion']('(1.0,2.0]')).toBe(false);
      expect(VersionResolver['isSpecificVersion']('[1.0,)')).toBe(false);
    });

    it('should not recognize invalid version formats', () => {
      // Act & Assert
      expect(VersionResolver['isSpecificVersion']('latest')).toBe(false);
      expect(VersionResolver['isSpecificVersion']('v1.0.0')).toBe(false);
      expect(VersionResolver['isSpecificVersion']('1.0.0+')).toBe(false);
    });
  });

  describe('isVersionRange', () => {
    it('should recognize inclusive ranges', () => {
      // Act & Assert
      expect(VersionResolver['isVersionRange']('[1.0,2.0]')).toBe(true);
      expect(VersionResolver['isVersionRange']('[1.0,]')).toBe(true);
      expect(VersionResolver['isVersionRange']('[,2.0]')).toBe(true);
    });

    it('should recognize exclusive ranges', () => {
      // Act & Assert
      expect(VersionResolver['isVersionRange']('(1.0,2.0)')).toBe(true);
      expect(VersionResolver['isVersionRange']('(1.0,)')).toBe(true);
      expect(VersionResolver['isVersionRange']('(,2.0)')).toBe(true);
    });

    it('should recognize mixed inclusive/exclusive ranges', () => {
      // Act & Assert
      expect(VersionResolver['isVersionRange']('[1.0,2.0)')).toBe(true);
      expect(VersionResolver['isVersionRange']('(1.0,2.0]')).toBe(true);
    });

    it('should not recognize non-range strings', () => {
      // Act & Assert
      expect(VersionResolver['isVersionRange']('1.0.0')).toBe(false);
      expect(VersionResolver['isVersionRange']('latest')).toBe(false);
      expect(VersionResolver['isVersionRange']('1.0.0-SNAPSHOT')).toBe(false);
    });
  });

  describe('parseVersionRange', () => {
    it('should parse inclusive range', () => {
      // Act
      const result = VersionResolver['parseVersionRange']('[1.0,2.0]');

      // Assert
      expect(result).toEqual({
        minVersion: '1.0',
        maxVersion: '2.0',
        includeMin: true,
        includeMax: true,
      });
    });

    it('should parse exclusive range', () => {
      // Act
      const result = VersionResolver['parseVersionRange']('(1.0,2.0)');

      // Assert
      expect(result).toEqual({
        minVersion: '1.0',
        maxVersion: '2.0',
        includeMin: false,
        includeMax: false,
      });
    });

    it('should parse mixed range', () => {
      // Act
      const result = VersionResolver['parseVersionRange']('[1.0,2.0)');

      // Assert
      expect(result).toEqual({
        minVersion: '1.0',
        maxVersion: '2.0',
        includeMin: true,
        includeMax: false,
      });
    });

    it('should parse open-ended range', () => {
      // Act
      const result = VersionResolver['parseVersionRange']('[1.0,)');

      // Assert
      expect(result).toEqual({
        minVersion: '1.0',
        maxVersion: undefined,
        includeMin: true,
        includeMax: false,
      });
    });

    it('should parse upper-bounded range', () => {
      // Act
      const result = VersionResolver['parseVersionRange']('[,2.0]');

      // Assert
      expect(result).toEqual({
        minVersion: undefined,
        maxVersion: '2.0',
        includeMin: true,
        includeMax: true,
      });
    });

    it('should handle empty parts', () => {
      // Act
      const result = VersionResolver['parseVersionRange']('[,]');

      // Assert
      expect(result).toEqual({
        minVersion: undefined,
        maxVersion: undefined,
        includeMin: true,
        includeMax: true,
      });
    });
  });

  describe('versionMatchesRange', () => {
    it('should match version within inclusive range', () => {
      // Act & Assert
      expect(VersionResolver['versionMatchesRange']('1.5.0', '1.0', '2.0', true, true)).toBe(true);
      expect(VersionResolver['versionMatchesRange']('1.0', '1.0', '2.0', true, true)).toBe(true);
      expect(VersionResolver['versionMatchesRange']('2.0', '1.0', '2.0', true, true)).toBe(true);
    });

    it('should match version within exclusive range', () => {
      // Act & Assert
      expect(VersionResolver['versionMatchesRange']('1.5.0', '1.0', '2.0', false, false)).toBe(true);
      expect(VersionResolver['versionMatchesRange']('1.0', '1.0', '2.0', false, false)).toBe(false);
      expect(VersionResolver['versionMatchesRange']('2.0', '1.0', '2.0', false, false)).toBe(false);
    });

    it('should handle open-ended ranges', () => {
      // Act & Assert
      expect(VersionResolver['versionMatchesRange']('3.0.0', '1.0', undefined, true, true)).toBe(true);
      expect(VersionResolver['versionMatchesRange']('0.5.0', '1.0', undefined, true, true)).toBe(false);
    });

    it('should handle upper-bounded ranges', () => {
      // Act & Assert
      expect(VersionResolver['versionMatchesRange']('1.5.0', undefined, '2.0', true, true)).toBe(true);
      expect(VersionResolver['versionMatchesRange']('2.5.0', undefined, '2.0', true, true)).toBe(false);
    });

    it('should handle unbounded ranges', () => {
      // Act & Assert
      expect(VersionResolver['versionMatchesRange']('1.0.0', undefined, undefined, true, true)).toBe(true);
      expect(VersionResolver['versionMatchesRange']('999.999.999', undefined, undefined, true, true)).toBe(true);
    });
  });

  describe('compareVersions', () => {
    it('should compare simple versions correctly', () => {
      // Act & Assert
      expect(VersionResolver['compareVersions']('1.0.0', '1.0.0')).toBe(0);
      expect(VersionResolver['compareVersions']('1.0.0', '1.0.1')).toBeLessThan(0);
      expect(VersionResolver['compareVersions']('1.0.1', '1.0.0')).toBeGreaterThan(0);
    });

    it('should compare versions with different part counts', () => {
      // Act & Assert
      expect(VersionResolver['compareVersions']('1.0', '1.0.0')).toBe(0);
      expect(VersionResolver['compareVersions']('1.0.1', '1.0')).toBeGreaterThan(0);
      expect(VersionResolver['compareVersions']('1.0', '1.0.1')).toBeLessThan(0);
    });

    it('should compare major versions correctly', () => {
      // Act & Assert
      expect(VersionResolver['compareVersions']('2.0.0', '1.9.9')).toBeGreaterThan(0);
      expect(VersionResolver['compareVersions']('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should handle version suffixes', () => {
      // Act & Assert
      expect(VersionResolver['compareVersions']('1.0.0', '1.0.0-SNAPSHOT')).toBeGreaterThan(0);
      expect(VersionResolver['compareVersions']('1.0.0-SNAPSHOT', '1.0.0')).toBeLessThan(0);
      expect(VersionResolver['compareVersions']('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    });

    it('should handle complex version strings', () => {
      // Act & Assert
      expect(VersionResolver['compareVersions']('1.0.0-alpha-1', '1.0.0-alpha-2')).toBeLessThan(0);
      expect(VersionResolver['compareVersions']('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
    });

    it('should handle invalid version strings', () => {
      // Act & Assert
      expect(VersionResolver['compareVersions']('invalid', '1.0.0')).toBeLessThan(0);
      expect(VersionResolver['compareVersions']('1.0.0', 'invalid')).toBeGreaterThan(0);
      expect(VersionResolver['compareVersions']('invalid', 'invalid')).toBe(0);
    });
  });

  describe('getAvailableVersions', () => {
    it('should return available versions from maven central', async () => {
      // Arrange
      const groupId = 'com.example';
      const artifactId = 'test-artifact';
      const versions = ['2.0.0', '1.9.0', '1.8.0'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(versions);

      // Act
      const result = await VersionResolver.getAvailableVersions(groupId, artifactId);

      // Assert
      expect(result).toEqual(versions);
      expect(mavenCentralApi.getVersions).toHaveBeenCalledWith(groupId, artifactId);
    });
  });

  describe('isPreRelease', () => {
    it('should identify pre-release versions', () => {
      // Act & Assert
      expect(VersionResolver.isPreRelease('1.0.0-SNAPSHOT')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-alpha')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-beta')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-rc')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-milestone')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-cr')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-pr')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-dev')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-preview')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-early')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-experimental')).toBe(true);
    });

    it('should identify stable versions', () => {
      // Act & Assert
      expect(VersionResolver.isPreRelease('1.0.0')).toBe(false);
      expect(VersionResolver.isPreRelease('2.1.0')).toBe(false);
      expect(VersionResolver.isPreRelease('1.0.0-RELEASE')).toBe(false);
      expect(VersionResolver.isPreRelease('1.0.0-FINAL')).toBe(false);
    });

    it('should handle case insensitive matching', () => {
      // Act & Assert
      expect(VersionResolver.isPreRelease('1.0.0-ALPHA')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-Beta')).toBe(true);
      expect(VersionResolver.isPreRelease('1.0.0-RC')).toBe(true);
    });
  });

  describe('getLatestStableVersion', () => {
    it('should return latest stable version when available', async () => {
      // Arrange
      const groupId = 'com.example';
      const artifactId = 'test-artifact';
      const versions = ['2.0.0-SNAPSHOT', '1.9.0', '1.8.0-alpha', '1.7.0'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(versions);

      // Act
      const result = await VersionResolver.getLatestStableVersion(groupId, artifactId);

      // Assert
      expect(result).toBe('1.9.0');
      expect(mavenCentralApi.getVersions).toHaveBeenCalledWith(groupId, artifactId);
    });

    it('should return latest version when no stable versions exist', async () => {
      // Arrange
      const groupId = 'com.example';
      const artifactId = 'test-artifact';
      const versions = ['2.0.0-SNAPSHOT', '1.9.0-alpha', '1.8.0-beta'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(versions);

      // Act
      const result = await VersionResolver.getLatestStableVersion(groupId, artifactId);

      // Assert
      expect(result).toBe('2.0.0-SNAPSHOT');
      expect(mavenCentralApi.getVersions).toHaveBeenCalledWith(groupId, artifactId);
    });

    it('should return first stable version in sorted list', async () => {
      // Arrange
      const groupId = 'com.example';
      const artifactId = 'test-artifact';
      const versions = ['2.0.0-SNAPSHOT', '1.9.0', '1.8.0', '1.7.0-alpha'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(versions);

      // Act
      const result = await VersionResolver.getLatestStableVersion(groupId, artifactId);

      // Assert
      expect(result).toBe('1.9.0');
    });
  });

  describe('integration scenarios', () => {
    const groupId = 'com.example';
    const artifactId = 'test-artifact';

    it('should handle complex version range resolution', async () => {
      // Arrange
      const versionRange = '[1.5,2.0)';
      const availableVersions = ['2.1.0', '2.0.0', '1.9.0', '1.8.0', '1.5.0', '1.4.0'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(availableVersions);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId, versionRange);

      // Assert
      expect(result).toBe('1.9.0'); // Latest in range [1.5, 2.0)
    });

    it('should handle edge case version comparisons', async () => {
      // Arrange
      const versionRange = '[1.0.0,1.0.1)';
      const availableVersions = ['1.0.1', '1.0.0', '1.0.0-SNAPSHOT'];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(availableVersions);

      // Act
      const result = await VersionResolver.resolveVersion(groupId, artifactId, versionRange);

      // Assert
      expect(result).toBe('1.0.0'); // Only 1.0.0 matches [1.0.0, 1.0.1)
    });

    it('should handle pre-release filtering in stable version selection', async () => {
      // Arrange
      const versions = [
        '2.0.0-SNAPSHOT',
        '1.9.0-rc1',
        '1.8.0',
        '1.7.0-beta',
        '1.6.0',
        '1.5.0-alpha'
      ];
      vi.mocked(mavenCentralApi.getVersions).mockResolvedValue(versions);

      // Act
      const result = await VersionResolver.getLatestStableVersion(groupId, artifactId);

      // Assert
      expect(result).toBe('1.8.0'); // Latest stable version
    });
  });
});