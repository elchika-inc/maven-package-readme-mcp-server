import { InvalidPackageNameError } from '../types/index.js';

export class Validators {
  /**
   * Validates Maven package name format (groupId:artifactId)
   */
  static validatePackageName(packageName: string): { groupId: string; artifactId: string } {
    if (!packageName || typeof packageName !== 'string') {
      throw new InvalidPackageNameError(packageName);
    }

    const trimmed = packageName.trim();
    if (!trimmed) {
      throw new InvalidPackageNameError(packageName);
    }

    const parts = trimmed.split(':');
    if (parts.length !== 2) {
      throw new InvalidPackageNameError(packageName);
    }

    const [groupId, artifactId] = parts;

    // Validate groupId
    if (!groupId || !this.isValidGroupId(groupId)) {
      throw new InvalidPackageNameError(packageName);
    }

    // Validate artifactId
    if (!artifactId || !this.isValidArtifactId(artifactId)) {
      throw new InvalidPackageNameError(packageName);
    }

    return { groupId, artifactId };
  }

  /**
   * Validates Maven groupId format
   */
  private static isValidGroupId(groupId: string): boolean {
    // GroupId should be like a Java package name (reverse domain name)
    // Examples: org.springframework, com.google.guava, junit
    const groupIdRegex = /^[a-zA-Z0-9._-]+$/;
    return groupIdRegex.test(groupId) && groupId.length > 0;
  }

  /**
   * Validates Maven artifactId format
   */
  private static isValidArtifactId(artifactId: string): boolean {
    // ArtifactId should be lowercase with hyphens
    // Examples: spring-core, guava, junit-jupiter-api
    const artifactIdRegex = /^[a-zA-Z0-9._-]+$/;
    return artifactIdRegex.test(artifactId) && artifactId.length > 0;
  }

  /**
   * Validates version string
   */
  static validateVersion(version: string): boolean {
    if (!version || typeof version !== 'string') {
      return false;
    }

    // Allow "latest" as a special case
    if (version === 'latest') {
      return true;
    }

    // Maven version format (semantic versioning or custom)
    // Examples: 1.0.0, 2.1.0-SNAPSHOT, 1.0-alpha-1
    const versionRegex = /^[a-zA-Z0-9._-]+$/;
    return versionRegex.test(version);
  }

  /**
   * Validates search query
   */
  static validateSearchQuery(query: string): boolean {
    if (!query || typeof query !== 'string') {
      return false;
    }

    const trimmed = query.trim();
    return trimmed.length > 0 && trimmed.length <= 500;
  }

  /**
   * Validates limit parameter
   */
  static validateLimit(limit: number): boolean {
    return Number.isInteger(limit) && limit >= 1 && limit <= 250;
  }

  /**
   * Validates score parameter (0-1)
   */
  static validateScore(score: number): boolean {
    return typeof score === 'number' && score >= 0 && score <= 1;
  }

  /**
   * Sanitizes a string for safe usage in URLs and file paths
   */
  static sanitizeString(input: string): string {
    return input.replace(/[^a-zA-Z0-9._-]/g, '');
  }

  /**
   * Formats Maven coordinates for display
   */
  static formatMavenCoordinates(groupId: string, artifactId: string, version?: string): string {
    const coords = `${groupId}:${artifactId}`;
    return version ? `${coords}:${version}` : coords;
  }
}