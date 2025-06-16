import {
  GitHubReadmeResponse,
  PackageNotFoundError,
  RateLimitError,
  NetworkError,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { cache } from './cache.js';

export class GitHubApi {
  private static readonly BASE_URL = 'https://api.github.com';
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  private readonly token?: string | undefined;

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || undefined;
  }

  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GitHubApi.REQUEST_TIMEOUT);

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'maven-package-readme-mcp-server/1.0.0',
        'Accept': 'application/vnd.github.v3+json',
        ...options?.headers as Record<string, string>,
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new PackageNotFoundError(url);
        }
        if (response.status === 403) {
          const resetTime = response.headers.get('x-ratelimit-reset');
          const remaining = response.headers.get('x-ratelimit-remaining');
          
          if (remaining === '0') {
            const retryAfter = resetTime ? parseInt(resetTime, 10) - Math.floor(Date.now() / 1000) : undefined;
            throw new RateLimitError('GitHub API', retryAfter);
          }
        }
        if (response.status >= 500) {
          throw new Error(`GitHub API server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('GitHub API request timeout');
      }
      throw error;
    }
  }

  /**
   * Get README content from a GitHub repository
   */
  async getReadme(owner: string, repo: string): Promise<string> {
    const cacheKey = `github_readme:${owner}:${repo}`;
    const cached = cache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${GitHubApi.BASE_URL}/repos/${owner}/${repo}/readme`;
    
    logger.debug('Fetching README from GitHub', { owner, repo });

    return ErrorHandler.withRetry(async () => {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          'Accept': 'application/vnd.github.v3.raw',
        },
      });

      const readmeContent = await response.text();
      
      cache.set(cacheKey, readmeContent, 1800000); // 30 minutes cache
      logger.info('GitHub README fetched', { 
        owner, 
        repo, 
        size: readmeContent.length 
      });
      
      return readmeContent;
    }, 3, 1000, 'GitHub README fetch');
  }

  /**
   * Get README with metadata from a GitHub repository
   */
  async getReadmeWithMetadata(owner: string, repo: string): Promise<GitHubReadmeResponse> {
    const cacheKey = `github_readme_meta:${owner}:${repo}`;
    const cached = cache.get<GitHubReadmeResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${GitHubApi.BASE_URL}/repos/${owner}/${repo}/readme`;
    
    logger.debug('Fetching README metadata from GitHub', { owner, repo });

    return ErrorHandler.withRetry(async () => {
      const response = await this.fetchWithTimeout(url);
      const data = await response.json() as GitHubReadmeResponse;
      
      cache.set(cacheKey, data, 1800000); // 30 minutes cache
      logger.info('GitHub README metadata fetched', { 
        owner, 
        repo, 
        filename: data.name,
        size: data.size
      });
      
      return data;
    }, 3, 1000, 'GitHub README metadata fetch');
  }

  /**
   * Decode base64 content from GitHub API
   */
  decodeContent(content: string): string {
    try {
      return Buffer.from(content, 'base64').toString('utf-8');
    } catch (error) {
      logger.error('Failed to decode GitHub content', { error });
      throw new Error('Failed to decode GitHub content');
    }
  }

  /**
   * Extract GitHub repository information from various URL formats
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
      const urlObj = new URL(url);
      
      // Handle github.com URLs
      if (urlObj.hostname === 'github.com') {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          return {
            owner: pathParts[0],
            repo: pathParts[1].replace(/\.git$/, ''), // Remove .git suffix if present
          };
        }
      }

      // Handle git+https URLs
      if (url.startsWith('git+https://github.com/')) {
        const cleanUrl = url.replace('git+', '');
        return this.parseGitHubUrl(cleanUrl);
      }

      // Handle scm:git URLs
      if (url.startsWith('scm:git:')) {
        const cleanUrl = url.replace('scm:git:', '');
        return this.parseGitHubUrl(cleanUrl);
      }

      return null;
    } catch (error) {
      logger.debug('Failed to parse GitHub URL', { url, error });
      return null;
    }
  }

  /**
   * Check if the repository exists
   */
  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      const url = `${GitHubApi.BASE_URL}/repos/${owner}/${repo}`;
      const response = await this.fetchWithTimeout(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      if (error instanceof PackageNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    const cacheKey = `github_repo:${owner}:${repo}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = `${GitHubApi.BASE_URL}/repos/${owner}/${repo}`;
    
    return ErrorHandler.withRetry(async () => {
      const response = await this.fetchWithTimeout(url);
      const data = await response.json();
      
      cache.set(cacheKey, data, 1800000); // 30 minutes cache
      logger.debug('GitHub repository info fetched', { owner, repo });
      
      return data;
    }, 3, 1000, 'GitHub repository fetch');
  }
}

// Global instance
export const githubApi = new GitHubApi();