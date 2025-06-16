export interface UsageExample {
  title: string;
  description?: string | undefined;
  code: string;
  language: string; // 'java', 'xml', 'kotlin', 'scala', 'groovy', etc.
}

export interface InstallationInfo {
  maven: string;      // Maven XML dependency
  gradle?: string;    // Gradle dependency
  sbt?: string;       // SBT dependency
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface RepositoryInfo {
  type: string;
  url: string;
  directory?: string | undefined;
}

export interface PackageBasicInfo {
  groupId: string;
  artifactId: string;
  version: string;
  description: string;
  packaging?: string | undefined;
  homepage?: string | undefined;
  license: string;
  organization?: string | undefined;
  developers?: AuthorInfo[] | undefined;
  keywords: string[];
}

export interface DownloadStats {
  last_day: number;
  last_week: number;
  last_month: number;
}

export interface PackageSearchResult {
  groupId: string;
  artifactId: string;
  version: string;
  description: string;
  keywords: string[];
  organization?: string;
  repositoryId: string;
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
}

// Tool Parameters
export interface GetPackageReadmeParams {
  package_name: string;    // Package name in groupId:artifactId format (required)
  version?: string;        // Version specification (optional, default: "latest")
  include_examples?: boolean; // Whether to include examples (optional, default: true)
}

export interface GetPackageInfoParams {
  package_name: string;    // groupId:artifactId format
  include_dependencies?: boolean; // Whether to include dependencies (default: true)
  include_dev_dependencies?: boolean; // Whether to include test dependencies (default: false)
}

export interface SearchPackagesParams {
  query: string;          // Search query
  limit?: number;         // Maximum results (default: 20)
  quality?: number;       // Minimum quality score (0-1)
  popularity?: number;    // Minimum popularity score (0-1)
}

// Tool Responses
export interface PackageReadmeResponse {
  package_name: string;   // groupId:artifactId
  version: string;
  description: string;
  readme_content: string;
  usage_examples: UsageExample[];
  installation: InstallationInfo;
  basic_info: PackageBasicInfo;
  repository?: RepositoryInfo | undefined;
}

export interface PackageInfoResponse {
  package_name: string;   // groupId:artifactId
  latest_version: string;
  description: string;
  organization?: string;
  license: string;
  keywords: string[];
  dependencies?: Record<string, string> | undefined;
  test_dependencies?: Record<string, string> | undefined;
  download_stats: DownloadStats;
  repository?: RepositoryInfo | undefined;
}

export interface SearchPackagesResponse {
  query: string;
  total: number;
  packages: PackageSearchResult[];
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// Maven Central API Types
export interface MavenSearchResponse {
  response: {
    numFound: number;
    start: number;
    docs: MavenSearchDoc[];
  };
}

export interface MavenSearchDoc {
  id: string;
  g: string; // groupId
  a: string; // artifactId
  v: string; // version
  p: string; // packaging
  timestamp: number;
  tags?: string[];
  ec?: string[]; // extension classifiers
  text?: string[];
}

export interface MavenMetadata {
  groupId: string;
  artifactId: string;
  versioning: {
    latest: string;
    release: string;
    versions: {
      version: string[];
    };
    lastUpdated: string;
  };
}

export interface MavenPomXml {
  project: {
    modelVersion?: string | undefined;
    groupId?: string | undefined;
    artifactId?: string | undefined;
    version?: string | undefined;
    packaging?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    url?: string | undefined;
    licenses?: {
      license: {
        name: string;
        url?: string;
        distribution?: string;
      }[];
    };
    developers?: {
      developer: {
        id?: string;
        name?: string;
        email?: string;
        url?: string;
        organization?: string;
        organizationUrl?: string;
        roles?: {
          role: string[];
        };
      }[];
    };
    organization?: {
      name: string;
      url?: string;
    };
    scm?: {
      connection?: string;
      developerConnection?: string;
      tag?: string;
      url?: string;
    };
    issueManagement?: {
      system?: string;
      url?: string;
    };
    dependencies?: {
      dependency: {
        groupId: string;
        artifactId: string;
        version?: string;
        type?: string;
        scope?: string;
        classifier?: string;
        optional?: boolean;
        exclusions?: {
          exclusion: {
            groupId: string;
            artifactId: string;
          }[];
        };
      }[];
    };
    parent?: {
      groupId: string;
      artifactId: string;
      version: string;
      relativePath?: string;
    };
    properties?: Record<string, string>;
  };
}

// GitHub API Types (for README fallback)
export interface GitHubReadmeResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

// Error Types
export class PackageReadmeMcpError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PackageReadmeMcpError';
  }
}

export class PackageNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string) {
    super(`Package '${packageName}' not found`, 'PACKAGE_NOT_FOUND', 404);
  }
}

export class VersionNotFoundError extends PackageReadmeMcpError {
  constructor(packageName: string, version: string) {
    super(`Version '${version}' of package '${packageName}' not found`, 'VERSION_NOT_FOUND', 404);
  }
}

export class RateLimitError extends PackageReadmeMcpError {
  constructor(service: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${service}`, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

export class NetworkError extends PackageReadmeMcpError {
  constructor(message: string, originalError?: Error) {
    super(`Network error: ${message}`, 'NETWORK_ERROR', undefined, originalError);
  }
}

export class InvalidPackageNameError extends PackageReadmeMcpError {
  constructor(packageName: string) {
    super(`Invalid package name format: '${packageName}'. Expected format: groupId:artifactId`, 'INVALID_PACKAGE_NAME', 400);
  }
}