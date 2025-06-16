import { mavenCentralApi } from './maven-central-api.js';
import { VersionNotFoundError } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class VersionResolver {
  /**
   * Resolve version string to actual version
   * Handles "latest", version ranges, and specific versions
   */
  static async resolveVersion(
    groupId: string,
    artifactId: string,
    versionSpec: string = 'latest'
  ): Promise<string> {
    const packageName = `${groupId}:${artifactId}`;
    
    // Handle "latest" version
    if (versionSpec === 'latest' || !versionSpec) {
      logger.debug('Resolving latest version', { groupId, artifactId });
      return await mavenCentralApi.getLatestVersion(groupId, artifactId);
    }

    // Handle specific version
    if (this.isSpecificVersion(versionSpec)) {
      logger.debug('Using specific version', { groupId, artifactId, version: versionSpec });
      
      // Verify the version exists
      const exists = await mavenCentralApi.versionExists(groupId, artifactId, versionSpec);
      if (!exists) {
        throw new VersionNotFoundError(packageName, versionSpec);
      }
      
      return versionSpec;
    }

    // Handle version ranges (simplified)
    if (this.isVersionRange(versionSpec)) {
      logger.debug('Resolving version range', { groupId, artifactId, range: versionSpec });
      return await this.resolveVersionRange(groupId, artifactId, versionSpec);
    }

    // If we can't parse the version spec, try to use it as-is
    logger.warn('Unknown version specification, trying as literal', { 
      groupId, 
      artifactId, 
      versionSpec 
    });
    
    const exists = await mavenCentralApi.versionExists(groupId, artifactId, versionSpec);
    if (!exists) {
      throw new VersionNotFoundError(packageName, versionSpec);
    }
    
    return versionSpec;
  }

  /**
   * Check if version string represents a specific version
   */
  private static isSpecificVersion(version: string): boolean {
    // Match patterns like: 1.0.0, 2.1.0-SNAPSHOT, 1.0-alpha-1, etc.
    const specificVersionRegex = /^[0-9]+(\.[0-9]+)*(-[a-zA-Z0-9.-]+)?$/;
    return specificVersionRegex.test(version);
  }

  /**
   * Check if version string represents a version range
   */
  private static isVersionRange(version: string): boolean {
    // Maven version range patterns: [1.0,2.0), (1.0,2.0), [1.0,), etc.
    const rangePatterns = [
      /^\[.+\]$/, // [1.0,2.0]
      /^\(.+\)$/, // (1.0,2.0)
      /^\[.+\)$/, // [1.0,2.0)
      /^\(.+\]$/, // (1.0,2.0]
    ];
    
    return rangePatterns.some(pattern => pattern.test(version));
  }

  /**
   * Resolve version range to specific version
   * Simplified implementation - returns latest version that matches range
   */
  private static async resolveVersionRange(
    groupId: string,
    artifactId: string,
    range: string
  ): Promise<string> {
    const versions = await mavenCentralApi.getVersions(groupId, artifactId);
    
    // Parse range (simplified)
    const { minVersion, maxVersion, includeMin, includeMax } = this.parseVersionRange(range);
    
    // Filter versions that match the range
    const matchingVersions = versions.filter(version => {
      return this.versionMatchesRange(version, minVersion, maxVersion, includeMin, includeMax);
    });

    if (matchingVersions.length === 0) {
      throw new VersionNotFoundError(`${groupId}:${artifactId}`, range);
    }

    // Return the latest matching version
    return matchingVersions[0]; // Already sorted descending
  }

  /**
   * Parse version range string
   */
  private static parseVersionRange(range: string): {
    minVersion?: string | undefined;
    maxVersion?: string | undefined;
    includeMin: boolean;
    includeMax: boolean;
  } {
    // Remove brackets/parentheses and split by comma
    const cleaned = range.replace(/^[\[\(]|[\]\)]$/g, '');
    const parts = cleaned.split(',');
    
    const includeMin = range.startsWith('[');
    const includeMax = range.endsWith(']');
    
    const minVersion = parts[0]?.trim() || undefined;
    const maxVersion = parts[1]?.trim() || undefined;
    
    return {
      minVersion: minVersion && minVersion.length > 0 ? minVersion : undefined,
      maxVersion: maxVersion && maxVersion.length > 0 ? maxVersion : undefined,
      includeMin,
      includeMax,
    };
  }

  /**
   * Check if a version matches a range
   */
  private static versionMatchesRange(
    version: string,
    minVersion?: string,
    maxVersion?: string,
    includeMin: boolean = true,
    includeMax: boolean = true
  ): boolean {
    if (minVersion) {
      const comparison = this.compareVersions(version, minVersion);
      if (includeMin ? comparison < 0 : comparison <= 0) {
        return false;
      }
    }

    if (maxVersion) {
      const comparison = this.compareVersions(version, maxVersion);
      if (includeMax ? comparison > 0 : comparison >= 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compare two version strings
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private static compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      // Extract numeric parts and handle suffixes
      const match = version.match(/^(\d+(?:\.\d+)*)(.*)$/);
      if (!match) return { numbers: [0], suffix: version };
      
      const numbers = match[1].split('.').map(Number);
      const suffix = match[2] || '';
      
      return { numbers, suffix };
    };

    const versionA = parseVersion(a);
    const versionB = parseVersion(b);

    // Compare numeric parts
    const maxLength = Math.max(versionA.numbers.length, versionB.numbers.length);
    for (let i = 0; i < maxLength; i++) {
      const numA = versionA.numbers[i] || 0;
      const numB = versionB.numbers[i] || 0;
      
      if (numA !== numB) {
        return numA - numB;
      }
    }

    // Compare suffixes (simplified)
    if (versionA.suffix !== versionB.suffix) {
      // No suffix is considered higher than any suffix
      if (!versionA.suffix && versionB.suffix) return 1;
      if (versionA.suffix && !versionB.suffix) return -1;
      
      // Compare suffixes lexicographically
      return versionA.suffix.localeCompare(versionB.suffix);
    }

    return 0;
  }

  /**
   * Get all versions for a package sorted by version
   */
  static async getAvailableVersions(groupId: string, artifactId: string): Promise<string[]> {
    return await mavenCentralApi.getVersions(groupId, artifactId);
  }

  /**
   * Check if a version is a pre-release (alpha, beta, snapshot, etc.)
   */
  static isPreRelease(version: string): boolean {
    const preReleaseKeywords = [
      'alpha', 'beta', 'rc', 'snapshot', 'milestone', 'cr', 'pr',
      'dev', 'preview', 'early', 'experimental'
    ];
    
    const lowerVersion = version.toLowerCase();
    return preReleaseKeywords.some(keyword => lowerVersion.includes(keyword));
  }

  /**
   * Get the latest stable version (excluding pre-releases)
   */
  static async getLatestStableVersion(groupId: string, artifactId: string): Promise<string> {
    const versions = await mavenCentralApi.getVersions(groupId, artifactId);
    
    const stableVersions = versions.filter(version => !this.isPreRelease(version));
    
    if (stableVersions.length === 0) {
      // If no stable versions, return the latest version
      return versions[0];
    }
    
    return stableVersions[0]; // First stable version (already sorted)
  }
}