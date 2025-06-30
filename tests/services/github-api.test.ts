import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitHubApi } from '../../src/services/github-api.js';
import { PackageNotFoundError, RateLimitError, NetworkError } from '../../src/types/index.js';
import { cache } from '../../src/services/cache.js';

// Mock dependencies
vi.mock('../../src/services/cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../src/utils/error-handler.js', () => ({
  ErrorHandler: {
    withRetry: vi.fn((fn) => fn()),
  },
}));

describe('GitHubApi', () => {
  let githubApi: GitHubApi;
  let mockFetch: any;

  beforeEach(() => {
    githubApi = new GitHubApi();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance without token', () => {
      const api = new GitHubApi();
      expect(api).toBeInstanceOf(GitHubApi);
    });

    it('should create instance with token', () => {
      const api = new GitHubApi('test-token');
      expect(api).toBeInstanceOf(GitHubApi);
    });

    it('should use environment token when available', () => {
      const originalEnv = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'env-token';
      
      const api = new GitHubApi();
      expect(api).toBeInstanceOf(GitHubApi);
      
      process.env.GITHUB_TOKEN = originalEnv;
    });
  });

  describe('getReadme', () => {
    const owner = 'testOwner';
    const repo = 'testRepo';
    const readmeContent = '# Test README\n\nThis is a test readme.';

    it('should return cached README if available', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(readmeContent);

      // Act
      const result = await githubApi.getReadme(owner, repo);

      // Assert
      expect(result).toBe(readmeContent);
      expect(cache.get).toHaveBeenCalledWith(`github_readme:${owner}:${repo}`);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch README from GitHub API', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(readmeContent),
      });

      // Act
      const result = await githubApi.getReadme(owner, repo);

      // Assert
      expect(result).toBe(readmeContent);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'maven-package-readme-mcp-server/1.0.0',
          }),
        })
      );
      expect(cache.set).toHaveBeenCalledWith(
        `github_readme:${owner}:${repo}`,
        readmeContent,
        1800000
      );
    });

    it('should include authorization header when token is provided', async () => {
      // Arrange
      const apiWithToken = new GitHubApi('test-token');
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(readmeContent),
      });

      // Act
      await apiWithToken.getReadme(owner, repo);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'token test-token',
          }),
        })
      );
    });

    it('should throw PackageNotFoundError for 404 response', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Act & Assert
      await expect(githubApi.getReadme(owner, repo)).rejects.toThrow(PackageNotFoundError);
    });

    it('should throw RateLimitError for 403 response with rate limit', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Map([
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
      });

      // Act & Assert
      await expect(githubApi.getReadme(owner, repo)).rejects.toThrow(RateLimitError);
    });

    it('should throw error for server errors', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Act & Assert
      await expect(githubApi.getReadme(owner, repo)).rejects.toThrow('GitHub API server error: 500 Internal Server Error');
    });

    it('should handle request timeout', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      // Act
      const promise = githubApi.getReadme(owner, repo);
      vi.advanceTimersByTime(30000);

      // Assert
      await expect(promise).rejects.toThrow(NetworkError);
    });
  });

  describe('getReadmeWithMetadata', () => {
    const owner = 'testOwner';
    const repo = 'testRepo';
    const readmeMetadata = {
      name: 'README.md',
      size: 123,
      content: 'base64content',
      encoding: 'base64' as const,
    };

    it('should return cached metadata if available', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(readmeMetadata);

      // Act
      const result = await githubApi.getReadmeWithMetadata(owner, repo);

      // Assert
      expect(result).toBe(readmeMetadata);
      expect(cache.get).toHaveBeenCalledWith(`github_readme_meta:${owner}:${repo}`);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch metadata from GitHub API', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(readmeMetadata),
      });

      // Act
      const result = await githubApi.getReadmeWithMetadata(owner, repo);

      // Assert
      expect(result).toEqual(readmeMetadata);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json',
          }),
        })
      );
      expect(cache.set).toHaveBeenCalledWith(
        `github_readme_meta:${owner}:${repo}`,
        readmeMetadata,
        1800000
      );
    });
  });

  describe('decodeContent', () => {
    it('should decode base64 content correctly', () => {
      // Arrange
      const content = Buffer.from('Hello World', 'utf-8').toString('base64');

      // Act
      const result = githubApi.decodeContent(content);

      // Assert
      expect(result).toBe('Hello World');
    });

    it('should throw error for invalid base64 content', () => {
      // Arrange
      const invalidContent = 'invalid-base64!@#$%';

      // Act & Assert
      expect(() => githubApi.decodeContent(invalidContent)).toThrow('Failed to decode GitHub content');
    });
  });

  describe('parseGitHubUrl', () => {
    it('should parse standard GitHub URL', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('https://github.com/owner/repo');

      // Assert
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub URL with .git suffix', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('https://github.com/owner/repo.git');

      // Assert
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse git+https URL', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('git+https://github.com/owner/repo.git');

      // Assert
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse scm:git URL', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('scm:git:https://github.com/owner/repo.git');

      // Assert
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should return null for non-GitHub URL', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('https://gitlab.com/owner/repo');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for invalid URL', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('invalid-url');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for GitHub URL with insufficient path parts', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('https://github.com/owner');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle GitHub URL with additional path segments', () => {
      // Act
      const result = GitHubApi.parseGitHubUrl('https://github.com/owner/repo/blob/main/README.md');

      // Assert
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });
  });

  describe('repositoryExists', () => {
    const owner = 'testOwner';
    const repo = 'testRepo';

    it('should return true for existing repository', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
      });

      // Act
      const result = await githubApi.repositoryExists(owner, repo);

      // Assert
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${owner}/${repo}`,
        { method: 'HEAD' }
      );
    });

    it('should return false for non-existing repository', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Act
      const result = await githubApi.repositoryExists(owner, repo);

      // Assert
      expect(result).toBe(false);
    });

    it('should propagate non-404 errors', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // Act & Assert
      await expect(githubApi.repositoryExists(owner, repo)).rejects.toThrow();
    });
  });

  describe('getRepository', () => {
    const owner = 'testOwner';
    const repo = 'testRepo';
    const repoData = {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      description: 'Test repository',
      stars_count: 42,
    };

    it('should return cached repository data if available', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(repoData);

      // Act
      const result = await githubApi.getRepository(owner, repo);

      // Assert
      expect(result).toBe(repoData);
      expect(cache.get).toHaveBeenCalledWith(`github_repo:${owner}:${repo}`);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch repository data from GitHub API', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(repoData),
      });

      // Act
      const result = await githubApi.getRepository(owner, repo);

      // Assert
      expect(result).toEqual(repoData);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.github.com/repos/${owner}/${repo}`
      );
      expect(cache.set).toHaveBeenCalledWith(
        `github_repo:${owner}:${repo}`,
        repoData,
        1800000
      );
    });
  });

  describe('error handling', () => {
    const owner = 'testOwner';
    const repo = 'testRepo';

    it('should handle fetch network errors', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(githubApi.getReadme(owner, repo)).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act & Assert
      await expect(githubApi.getReadmeWithMetadata(owner, repo)).rejects.toThrow('Invalid JSON');
    });

    it('should handle text parsing errors', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.reject(new Error('Text error')),
      });

      // Act & Assert
      await expect(githubApi.getReadme(owner, repo)).rejects.toThrow('Text error');
    });
  });

  describe('headers and configuration', () => {
    it('should set correct default headers', async () => {
      // Arrange
      vi.mocked(cache.get).mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      });

      // Act
      await githubApi.getReadme('owner', 'repo');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'maven-package-readme-mcp-server/1.0.0',
            'Accept': 'application/vnd.github.v3.raw',
          }),
        })
      );
    });

    it('should handle timeout configuration', () => {
      // Arrange & Act
      const api = new GitHubApi();

      // Assert - Should not throw during construction
      expect(api).toBeInstanceOf(GitHubApi);
    });
  });
});