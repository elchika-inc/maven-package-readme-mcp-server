import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MavenCentralApi } from '../../src/services/maven-central-api.js';
import { 
  PackageNotFoundError, 
  VersionNotFoundError, 
  NetworkError, 
  RateLimitError 
} from '../../src/types/index.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to reduce test noise
const originalConsole = console;
beforeAll(() => {
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  } as any;
});

afterAll(() => {
  global.console = originalConsole;
});

describe('MavenCentralApi', () => {
  let api: MavenCentralApi;

  beforeEach(() => {
    api = new MavenCentralApi();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchPackages', () => {
    it('should search packages successfully', async () => {
      const mockResponse = {
        response: {
          numFound: 1,
          docs: [
            {
              id: 'org.springframework:spring-core',
              g: 'org.springframework',
              a: 'spring-core',
              v: '6.0.0',
              latestVersion: '6.0.0'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await api.searchPackages('spring-core');
      
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search.maven.org'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'maven-package-readme-mcp-server/1.0.0'
          })
        })
      );
    });

    it('should handle rate limiting', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '60']])
      };
      mockResponse.headers.get = (header: string) => header === 'retry-after' ? '60' : null;
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(api.searchPackages('test')).rejects.toThrow(RateLimitError);
    });

    it('should handle network timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));

      await expect(api.searchPackages('test')).rejects.toThrow(NetworkError);
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest version', async () => {
      const mockResponse = {
        response: {
          numFound: 2,
          docs: [
            { v: '6.0.0' },
            { v: '5.3.21' }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const version = await api.getLatestVersion('org.springframework', 'spring-core');
      expect(version).toBe('6.0.0');
    });

    it('should throw PackageNotFoundError when package not found', async () => {
      const mockResponse = {
        response: {
          numFound: 0,
          docs: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(api.getLatestVersion('nonexistent', 'package')).rejects.toThrow(PackageNotFoundError);
    });
  });

  describe('getVersions', () => {
    it('should return sorted versions', async () => {
      const mockResponse = {
        response: {
          numFound: 3,
          docs: [
            { v: '5.3.21' },
            { v: '6.0.0' },
            { v: '5.3.20' }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const versions = await api.getVersions('org.springframework', 'spring-core');
      expect(versions).toEqual(['6.0.0', '5.3.21']);
    });

    it('should handle latestVersion field', async () => {
      const mockResponse = {
        response: {
          numFound: 1,
          docs: [
            { latestVersion: '6.0.0' }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const versions = await api.getVersions('org.springframework', 'spring-core');
      expect(versions).toEqual(['6.0.0']);
    });
  });

  describe('getPomXml', () => {
    it('should fetch POM XML successfully', async () => {
      const mockPomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <groupId>org.springframework</groupId>
  <artifactId>spring-core</artifactId>
  <version>6.0.0</version>
  <name>Spring Core</name>
  <description>Spring Framework Core</description>
</project>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockPomContent)
      });

      const result = await api.getPomXml('org.springframework', 'spring-core', '6.0.0');
      expect(result).toBe(mockPomContent);
    });

    it('should throw VersionNotFoundError for 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(api.getPomXml('org.springframework', 'spring-core', '999.0.0'))
        .rejects.toThrow(VersionNotFoundError);
    });
  });

  describe('parsePomXml', () => {
    it('should parse POM XML correctly', () => {
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <groupId>org.springframework</groupId>
  <artifactId>spring-core</artifactId>
  <version>6.0.0</version>
  <packaging>jar</packaging>
  <name>Spring Core</name>
  <description>Spring Framework Core</description>
  <url>https://spring.io/projects/spring-framework</url>
</project>`;

      const result = api.parsePomXml(pomContent);
      
      expect(result.project).toEqual({
        groupId: 'org.springframework',
        artifactId: 'spring-core',
        version: '6.0.0',
        packaging: 'jar',
        name: 'Spring Core',
        description: 'Spring Framework Core',
        url: 'https://spring.io/projects/spring-framework'
      });
    });

    it('should handle malformed XML gracefully', () => {
      const malformedXml = '<invalid>xml</invalid>';
      const result = api.parsePomXml(malformedXml);
      
      expect(result).toEqual({ project: {} });
    });
  });

  describe('packageExists', () => {
    it('should return true when package exists', async () => {
      const mockResponse = {
        response: {
          numFound: 1,
          docs: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const exists = await api.packageExists('org.springframework', 'spring-core');
      expect(exists).toBe(true);
    });

    it('should return false when package does not exist', async () => {
      const mockResponse = {
        response: {
          numFound: 0,
          docs: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const exists = await api.packageExists('nonexistent', 'package');
      expect(exists).toBe(false);
    });
  });

  describe('versionExists', () => {
    it('should return true when version exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<project></project>')
      });

      const exists = await api.versionExists('org.springframework', 'spring-core', '6.0.0');
      expect(exists).toBe(true);
    });

    it('should return false when version does not exist', async () => {
      const versionNotFoundError = new Error('Not found: http://example.com');
      mockFetch.mockImplementationOnce(() => {
        throw versionNotFoundError;
      });

      const exists = await api.versionExists('org.springframework', 'spring-core', '999.0.0');
      expect(exists).toBe(false);
    });
  });
});