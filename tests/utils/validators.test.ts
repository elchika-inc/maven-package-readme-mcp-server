import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Validators } from '../../src/utils/validators.js';
import { InvalidPackageNameError } from '../../src/types/index.js';

describe('Validators', () => {
  describe('validatePackageName', () => {
    it('should validate standard Maven package names', () => {
      // Arrange
      const testCases = [
        'org.springframework:spring-core',
        'com.google.guava:guava',
        'junit:junit',
        'org.apache.commons:commons-lang3',
        'com.fasterxml.jackson.core:jackson-core'
      ];

      // Act & Assert
      testCases.forEach(packageName => {
        const result = Validators.validatePackageName(packageName);
        const [expectedGroupId, expectedArtifactId] = packageName.split(':');
        
        expect(result.groupId).toBe(expectedGroupId);
        expect(result.artifactId).toBe(expectedArtifactId);
      });
    });

    it('should validate package names with numbers and special characters', () => {
      // Arrange
      const packageName = 'org.example-test.lib_v2:my-artifact_1.0';

      // Act
      const result = Validators.validatePackageName(packageName);

      // Assert
      expect(result.groupId).toBe('org.example-test.lib_v2');
      expect(result.artifactId).toBe('my-artifact_1.0');
    });

    it('should validate package names with underscores and hyphens', () => {
      // Arrange
      const packageName = 'com.example_org:test-artifact_v2';

      // Act
      const result = Validators.validatePackageName(packageName);

      // Assert
      expect(result.groupId).toBe('com.example_org');
      expect(result.artifactId).toBe('test-artifact_v2');
    });

    it('should trim whitespace from package names', () => {
      // Arrange
      const packageName = '  org.springframework:spring-core  ';

      // Act
      const result = Validators.validatePackageName(packageName);

      // Assert
      expect(result.groupId).toBe('org.springframework');
      expect(result.artifactId).toBe('spring-core');
    });

    it('should throw error for null package name', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName(null as any))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for undefined package name', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName(undefined as any))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for non-string package name', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName(123 as any))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for empty string', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName(''))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for whitespace-only string', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName('   '))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for package name without colon', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName('org.springframework.spring-core'))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for package name with multiple colons', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName('org.springframework:spring-core:1.0.0'))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for missing groupId', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName(':spring-core'))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for missing artifactId', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName('org.springframework:'))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for invalid characters in groupId', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName('org.spring/work@:spring-core'))
        .toThrow(InvalidPackageNameError);
    });

    it('should throw error for invalid characters in artifactId', () => {
      // Act & Assert
      expect(() => Validators.validatePackageName('org.springframework:spring@core'))
        .toThrow(InvalidPackageNameError);
    });

    it('should handle edge case with only allowed special characters', () => {
      // Arrange
      const packageName = 'org.example._test-group:artifact._name-v1';

      // Act
      const result = Validators.validatePackageName(packageName);

      // Assert
      expect(result.groupId).toBe('org.example._test-group');
      expect(result.artifactId).toBe('artifact._name-v1');
    });
  });

  describe('validateVersion', () => {
    it('should validate standard semantic versions', () => {
      // Arrange
      const validVersions = [
        '1.0.0',
        '2.1.0',
        '0.9.1',
        '10.15.20'
      ];

      // Act & Assert
      validVersions.forEach(version => {
        expect(Validators.validateVersion(version)).toBe(true);
      });
    });

    it('should validate snapshot versions', () => {
      // Arrange
      const snapshotVersions = [
        '1.0.0-SNAPSHOT',
        '2.1.0-SNAPSHOT',
        '1.0-SNAPSHOT'
      ];

      // Act & Assert
      snapshotVersions.forEach(version => {
        expect(Validators.validateVersion(version)).toBe(true);
      });
    });

    it('should validate pre-release versions', () => {
      // Arrange
      const preReleaseVersions = [
        '1.0.0-alpha',
        '1.0.0-beta',
        '1.0.0-rc1',
        '1.0-alpha-1',
        '2.0.0-milestone.1'
      ];

      // Act & Assert
      preReleaseVersions.forEach(version => {
        expect(Validators.validateVersion(version)).toBe(true);
      });
    });

    it('should validate "latest" as special case', () => {
      // Act & Assert
      expect(Validators.validateVersion('latest')).toBe(true);
    });

    it('should validate custom version formats', () => {
      // Arrange
      const customVersions = [
        '1.0',
        '1',
        '1.0_01',
        '2021.12.01'
      ];

      // Act & Assert
      customVersions.forEach(version => {
        expect(Validators.validateVersion(version)).toBe(true);
      });
    });

    it('should reject null version', () => {
      // Act & Assert
      expect(Validators.validateVersion(null as any)).toBe(false);
    });

    it('should reject undefined version', () => {
      // Act & Assert
      expect(Validators.validateVersion(undefined as any)).toBe(false);
    });

    it('should reject non-string version', () => {
      // Act & Assert
      expect(Validators.validateVersion(123 as any)).toBe(false);
    });

    it('should reject empty string version', () => {
      // Act & Assert
      expect(Validators.validateVersion('')).toBe(false);
    });

    it('should reject versions with invalid characters', () => {
      // Arrange
      const invalidVersions = [
        '1.0.0@beta',
        '1.0.0/snapshot',
        '1.0.0 beta',
        '1.0.0#rc1'
      ];

      // Act & Assert
      invalidVersions.forEach(version => {
        expect(Validators.validateVersion(version)).toBe(false);
      });
    });
  });

  describe('validateSearchQuery', () => {
    it('should validate normal search queries', () => {
      // Arrange
      const validQueries = [
        'spring boot',
        'jackson',
        'junit jupiter',
        'apache commons',
        'google guava'
      ];

      // Act & Assert
      validQueries.forEach(query => {
        expect(Validators.validateSearchQuery(query)).toBe(true);
      });
    });

    it('should validate queries with special characters', () => {
      // Arrange
      const queriesWithSpecial = [
        'spring-boot',
        'jackson.core',
        'junit_5',
        'commons-lang3',
        'org.springframework'
      ];

      // Act & Assert
      queriesWithSpecial.forEach(query => {
        expect(Validators.validateSearchQuery(query)).toBe(true);
      });
    });

    it('should trim whitespace from queries', () => {
      // Act & Assert
      expect(Validators.validateSearchQuery('  spring boot  ')).toBe(true);
    });

    it('should reject null query', () => {
      // Act & Assert
      expect(Validators.validateSearchQuery(null as any)).toBe(false);
    });

    it('should reject undefined query', () => {
      // Act & Assert
      expect(Validators.validateSearchQuery(undefined as any)).toBe(false);
    });

    it('should reject non-string query', () => {
      // Act & Assert
      expect(Validators.validateSearchQuery(123 as any)).toBe(false);
    });

    it('should reject empty string query', () => {
      // Act & Assert
      expect(Validators.validateSearchQuery('')).toBe(false);
    });

    it('should reject whitespace-only query', () => {
      // Act & Assert
      expect(Validators.validateSearchQuery('   ')).toBe(false);
    });

    it('should reject queries that are too long', () => {
      // Arrange
      const longQuery = 'a'.repeat(501);

      // Act & Assert
      expect(Validators.validateSearchQuery(longQuery)).toBe(false);
    });

    it('should accept query at maximum length', () => {
      // Arrange
      const maxLengthQuery = 'a'.repeat(500);

      // Act & Assert
      expect(Validators.validateSearchQuery(maxLengthQuery)).toBe(true);
    });
  });

  describe('validateLimit', () => {
    it('should validate valid limits', () => {
      // Arrange
      const validLimits = [1, 10, 20, 50, 100, 250];

      // Act & Assert
      validLimits.forEach(limit => {
        expect(Validators.validateLimit(limit)).toBe(true);
      });
    });

    it('should reject limit less than 1', () => {
      // Act & Assert
      expect(Validators.validateLimit(0)).toBe(false);
      expect(Validators.validateLimit(-1)).toBe(false);
    });

    it('should reject limit greater than 250', () => {
      // Act & Assert
      expect(Validators.validateLimit(251)).toBe(false);
      expect(Validators.validateLimit(1000)).toBe(false);
    });

    it('should reject non-integer limits', () => {
      // Act & Assert
      expect(Validators.validateLimit(10.5)).toBe(false);
      expect(Validators.validateLimit(1.1)).toBe(false);
    });

    it('should reject non-number limits', () => {
      // Act & Assert
      expect(Validators.validateLimit('10' as any)).toBe(false);
      expect(Validators.validateLimit(null as any)).toBe(false);
      expect(Validators.validateLimit(undefined as any)).toBe(false);
    });

    it('should accept boundary values', () => {
      // Act & Assert
      expect(Validators.validateLimit(1)).toBe(true);
      expect(Validators.validateLimit(250)).toBe(true);
    });
  });

  describe('validateScore', () => {
    it('should validate valid scores', () => {
      // Arrange
      const validScores = [0, 0.1, 0.5, 0.8, 1.0];

      // Act & Assert
      validScores.forEach(score => {
        expect(Validators.validateScore(score)).toBe(true);
      });
    });

    it('should validate floating point scores', () => {
      // Arrange
      const floatScores = [0.333333, 0.666666, 0.123456];

      // Act & Assert
      floatScores.forEach(score => {
        expect(Validators.validateScore(score)).toBe(true);
      });
    });

    it('should reject scores less than 0', () => {
      // Act & Assert
      expect(Validators.validateScore(-0.1)).toBe(false);
      expect(Validators.validateScore(-1)).toBe(false);
    });

    it('should reject scores greater than 1', () => {
      // Act & Assert
      expect(Validators.validateScore(1.1)).toBe(false);
      expect(Validators.validateScore(2)).toBe(false);
    });

    it('should reject non-number scores', () => {
      // Act & Assert
      expect(Validators.validateScore('0.5' as any)).toBe(false);
      expect(Validators.validateScore(null as any)).toBe(false);
      expect(Validators.validateScore(undefined as any)).toBe(false);
    });

    it('should accept boundary values', () => {
      // Act & Assert
      expect(Validators.validateScore(0)).toBe(true);
      expect(Validators.validateScore(1)).toBe(true);
    });

    it('should handle edge case floating point precision', () => {
      // Act & Assert
      expect(Validators.validateScore(0.9999999999999999)).toBe(true);
      expect(Validators.validateScore(0.0000000000000001)).toBe(true);
    });
  });

  describe('sanitizeString', () => {
    it('should keep allowed characters', () => {
      // Arrange
      const input = 'abcDEF123._-';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('abcDEF123._-');
    });

    it('should remove special characters', () => {
      // Arrange
      const input = 'hello@world#test$value%';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('helloworldtestvalue');
    });

    it('should remove spaces', () => {
      // Arrange
      const input = 'hello world test';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('helloworldtest');
    });

    it('should handle mixed content', () => {
      // Arrange
      const input = 'spring-boot_2.7.0@SNAPSHOT';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('spring-boot_2.7.0SNAPSHOT');
    });

    it('should handle empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('');
    });

    it('should handle string with only special characters', () => {
      // Arrange
      const input = '@#$%^&*()';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('');
    });

    it('should preserve valid Maven coordinates format', () => {
      // Arrange
      const input = 'org.springframework-boot';

      // Act
      const result = Validators.sanitizeString(input);

      // Assert
      expect(result).toBe('org.springframework-boot');
    });
  });

  describe('formatMavenCoordinates', () => {
    it('should format coordinates without version', () => {
      // Act
      const result = Validators.formatMavenCoordinates('org.springframework', 'spring-core');

      // Assert
      expect(result).toBe('org.springframework:spring-core');
    });

    it('should format coordinates with version', () => {
      // Act
      const result = Validators.formatMavenCoordinates('org.springframework', 'spring-core', '5.3.0');

      // Assert
      expect(result).toBe('org.springframework:spring-core:5.3.0');
    });

    it('should handle empty version', () => {
      // Act
      const result = Validators.formatMavenCoordinates('junit', 'junit', '');

      // Assert
      expect(result).toBe('junit:junit:');
    });

    it('should handle undefined version', () => {
      // Act
      const result = Validators.formatMavenCoordinates('junit', 'junit', undefined);

      // Assert
      expect(result).toBe('junit:junit');
    });

    it('should format complex coordinates', () => {
      // Act
      const result = Validators.formatMavenCoordinates(
        'com.fasterxml.jackson.core',
        'jackson-core',
        '2.13.0'
      );

      // Assert
      expect(result).toBe('com.fasterxml.jackson.core:jackson-core:2.13.0');
    });

    it('should handle special characters in coordinates', () => {
      // Act
      const result = Validators.formatMavenCoordinates(
        'org.example_test',
        'my-artifact_v2',
        '1.0.0-SNAPSHOT'
      );

      // Assert
      expect(result).toBe('org.example_test:my-artifact_v2:1.0.0-SNAPSHOT');
    });
  });

  describe('integration tests', () => {
    it('should work together for complete package validation', () => {
      // Arrange
      const packageName = 'org.springframework:spring-boot-starter-web';
      const version = '2.7.0';

      // Act
      const packageInfo = Validators.validatePackageName(packageName);
      const isValidVersion = Validators.validateVersion(version);
      const formattedCoords = Validators.formatMavenCoordinates(
        packageInfo.groupId,
        packageInfo.artifactId,
        version
      );

      // Assert
      expect(packageInfo.groupId).toBe('org.springframework');
      expect(packageInfo.artifactId).toBe('spring-boot-starter-web');
      expect(isValidVersion).toBe(true);
      expect(formattedCoords).toBe('org.springframework:spring-boot-starter-web:2.7.0');
    });

    it('should handle edge cases in search validation', () => {
      // Arrange
      const query = '  spring boot  ';
      const limit = 50;
      const quality = 0.8;

      // Act
      const isValidQuery = Validators.validateSearchQuery(query);
      const isValidLimit = Validators.validateLimit(limit);
      const isValidQuality = Validators.validateScore(quality);

      // Assert
      expect(isValidQuery).toBe(true);
      expect(isValidLimit).toBe(true);
      expect(isValidQuality).toBe(true);
    });
  });
});