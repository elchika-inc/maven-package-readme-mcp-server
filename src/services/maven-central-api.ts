import {
  MavenSearchResponse,
  MavenPomXml,
  PackageNotFoundError,
  VersionNotFoundError,
  NetworkError,
  RateLimitError,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { cache, CacheService } from './cache.js';

export class MavenCentralApi {
  private static readonly SEARCH_BASE_URL = 'https://search.maven.org/solrsearch/select';
  private static readonly REPO_BASE_URL = 'https://repo1.maven.org/maven2';
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MavenCentralApi.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'maven-package-readme-mcp-server/1.0.0',
          ...options?.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Not found: ${url}`);
        }
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          throw new RateLimitError('Maven Central', retryAfter ? parseInt(retryAfter, 10) : undefined);
        }
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Search for packages in Maven Central
   */
  async searchPackages(
    query: string,
    rows: number = 20,
    start: number = 0
  ): Promise<MavenSearchResponse> {
    const cacheKey = CacheService.generateSearchKey(query, rows);
    const cached = cache.get<MavenSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(MavenCentralApi.SEARCH_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('rows', rows.toString());
    url.searchParams.set('start', start.toString());
    url.searchParams.set('wt', 'json');

    logger.debug('Searching Maven Central', { query, rows, start });

    return ErrorHandler.withRetry(async () => {
      const response = await this.fetchWithTimeout(url.toString());
      const data = await response.json() as MavenSearchResponse;
      
      cache.set(cacheKey, data, 300000); // 5 minutes cache for search results
      logger.info('Maven Central search completed', { 
        query, 
        found: data.response.numFound,
        returned: data.response.docs.length 
      });
      
      return data;
    }, 3, 1000, 'Maven Central search');
  }

  /**
   * Get latest version for a package
   */
  async getLatestVersion(groupId: string, artifactId: string): Promise<string> {
    const versions = await this.getVersions(groupId, artifactId);
    if (versions.length === 0) {
      throw new PackageNotFoundError(`${groupId}:${artifactId}`);
    }
    
    // Return the latest version (versions should be sorted by timestamp)
    return versions[0];
  }

  /**
   * Get available versions for a package
   */
  async getVersions(groupId: string, artifactId: string): Promise<string[]> {
    const cacheKey = CacheService.generateVersionsKey(groupId, artifactId);
    const cached = cache.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to get versions from search API first
    const searchQuery = `g:"${groupId}" AND a:"${artifactId}"`;
    return ErrorHandler.withRetry(async () => {
      const searchResult = await this.searchPackages(searchQuery, 100); // Get more results for versions
      
      if (searchResult.response.numFound === 0) {
        throw new PackageNotFoundError(`${groupId}:${artifactId}`);
      }

      
      const versions = searchResult.response.docs
        .map(doc => doc.v || doc.latestVersion) // Try both v and latestVersion fields
        .filter((version): version is string => Boolean(version && typeof version === 'string')) // Remove undefined/null versions
        .filter((version, index, array) => array.indexOf(version) === index) // Remove duplicates
        .sort((a, b) => this.compareVersions(b, a)); // Sort descending (newest first)

      cache.set(cacheKey, versions, 1800000); // 30 minutes cache
      logger.debug('Retrieved versions', { groupId, artifactId, count: versions.length });
      
      return versions;
    }, 3, 1000, 'Maven versions fetch');
  }

  // getLatestVersion method already defined above

  /**
   * Get POM file content for a specific version
   */
  async getPomXml(groupId: string, artifactId: string, version: string): Promise<string> {
    const cacheKey = CacheService.generatePomKey(groupId, artifactId, version);
    const cached = cache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const groupPath = groupId.replace(/\./g, '/');
    const pomUrl = `${MavenCentralApi.REPO_BASE_URL}/${groupPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;

    logger.debug('Fetching POM XML', { groupId, artifactId, version, url: pomUrl });

    return ErrorHandler.withRetry(async () => {
      try {
        const response = await this.fetchWithTimeout(pomUrl);
        const pomContent = await response.text();
        
        cache.set(cacheKey, pomContent, 3600000); // 1 hour cache for POM files
        logger.debug('POM XML retrieved', { groupId, artifactId, version, size: pomContent.length });
        
        return pomContent;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Not found')) {
          throw new VersionNotFoundError(`${groupId}:${artifactId}`, version);
        }
        throw error;
      }
    }, 3, 1000, 'POM XML fetch');
  }

  /**
   * Parse POM XML content
   */
  parsePomXml(pomContent: string): Partial<MavenPomXml> {
    try {
      // Use regex-based parsing for Node.js compatibility
      return this.parsePomXmlRegex(pomContent);
    } catch (error) {
      logger.warn('Failed to parse POM XML', { error });
      return { project: {} };
    }
  }

  /**
   * Fallback POM parsing using regex (for environments without DOMParser)
   */
  private parsePomXmlRegex(pomContent: string): Partial<MavenPomXml> {
    const extractTag = (content: string, tagName: string): string | undefined => {
      const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : undefined;
    };

    return {
      project: {
        groupId: extractTag(pomContent, 'groupId'),
        artifactId: extractTag(pomContent, 'artifactId'),
        version: extractTag(pomContent, 'version'),
        packaging: extractTag(pomContent, 'packaging'),
        name: extractTag(pomContent, 'name'),
        description: extractTag(pomContent, 'description'),
        url: extractTag(pomContent, 'url'),
      }
    };
  }

  // Removed getElementText method as we're using regex parsing

  /**
   * Simple version comparison (semantic versioning)
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      const parts = version.replace(/[^0-9.]/g, '').split('.').map(Number);
      return parts.concat([0, 0, 0]).slice(0, 3); // Ensure 3 parts
    };

    const versionA = parseVersion(a);
    const versionB = parseVersion(b);

    for (let i = 0; i < 3; i++) {
      if (versionA[i] !== versionB[i]) {
        return versionA[i] - versionB[i];
      }
    }

    return 0;
  }

  /**
   * Check if a package exists in Maven Central
   */
  async packageExists(groupId: string, artifactId: string): Promise<boolean> {
    const cacheKey = CacheService.generatePackageExistsKey(groupId, artifactId);
    const cached = cache.get<boolean>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const searchQuery = `g:"${groupId}" AND a:"${artifactId}"`;
    
    return ErrorHandler.withRetry(async () => {
      const searchResult = await this.searchPackages(searchQuery, 1);
      const exists = searchResult.response.numFound > 0;
      
      cache.set(cacheKey, exists, 1800000); // 30 minutes cache
      logger.debug('Package existence check', { groupId, artifactId, exists });
      
      return exists;
    }, 3, 1000, 'Package existence check');
  }

  /**
   * Check if a specific version exists
   */
  async versionExists(groupId: string, artifactId: string, version: string): Promise<boolean> {
    try {
      await this.getPomXml(groupId, artifactId, version);
      return true;
    } catch (error) {
      if (error instanceof VersionNotFoundError) {
        return false;
      }
      throw error;
    }
  }
}

// Global instance
export const mavenCentralApi = new MavenCentralApi();