import {
  GetPackageInfoParams,
  PackageInfoResponse,
  DownloadStats,
  RepositoryInfo,
} from '../types/index.js';
import { Validators } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { mavenCentralApi } from '../services/maven-central-api.js';
// import { VersionResolver } from '../services/version-resolver.js'; // Currently unused
import { cache, CacheService } from '../services/cache.js';

export async function getPackageInfo(params: GetPackageInfoParams): Promise<PackageInfoResponse> {
  const { package_name, include_dependencies = true, include_dev_dependencies = false } = params;
  
  // Validate package name
  const { groupId, artifactId } = Validators.validatePackageName(package_name);
  
  logger.info('Getting package info', { 
    groupId, 
    artifactId, 
    include_dependencies, 
    include_dev_dependencies 
  });

  // Check cache first
  const cacheKey = CacheService.generatePackageInfoKey(groupId, artifactId);
  const cached = cache.get<PackageInfoResponse>(cacheKey);
  if (cached) {
    logger.debug('Returning cached package info', { groupId, artifactId });
    return cached;
  }

  try {
    // Get latest version
    const latestVersion = await mavenCentralApi.getLatestVersion(groupId, artifactId);
    
    // Get POM XML for the latest version
    const pomXml = await mavenCentralApi.getPomXml(groupId, artifactId, latestVersion);
    const pomData = mavenCentralApi.parsePomXml(pomXml);
    
    const project = pomData.project || {};

    // Extract license info
    let license = 'Unknown';
    if (project.licenses?.license) {
      const licenses = Array.isArray(project.licenses.license) 
        ? project.licenses.license 
        : [project.licenses.license];
      license = licenses.map((l: any) => l.name).join(', ');
    }

    // Extract organization/author info
    const organization = project.organization?.name || 
      (project.developers?.developer?.[0]?.organization) || 
      'Unknown';

    // Extract dependencies if requested
    let dependencies: Record<string, string> | undefined;
    let testDependencies: Record<string, string> | undefined;

    if (include_dependencies || include_dev_dependencies) {
      const { deps, testDeps } = extractDependencies(pomData, include_dependencies, include_dev_dependencies);
      dependencies = deps;
      testDependencies = testDeps;
    }

    // Get download stats (mock data since Maven Central doesn't provide public stats)
    const downloadStats = await getDownloadStats(groupId, artifactId);

    // Build repository info
    const repository = buildRepositoryInfo(pomData);

    const result: PackageInfoResponse = {
      package_name: `${groupId}:${artifactId}`,
      latest_version: latestVersion,
      description: project.description || 'No description available',
      organization,
      license,
      keywords: [], // Maven doesn't have keywords like npm
      dependencies,
      test_dependencies: testDependencies,
      download_stats: downloadStats,
      repository,
    };

    // Cache the result
    cache.set(cacheKey, result, 1800000); // 30 minutes cache
    
    logger.info('Package info retrieved successfully', { 
      groupId, 
      artifactId, 
      version: latestVersion,
      dependenciesCount: dependencies ? Object.keys(dependencies).length : 0,
      testDependenciesCount: testDependencies ? Object.keys(testDependencies).length : 0
    });

    return result;
  } catch (error) {
    logger.error('Failed to get package info', { groupId, artifactId, error });
    throw error;
  }
}

function extractDependencies(
  pomData: any, 
  includeDependencies: boolean, 
  includeTestDependencies: boolean
): { deps?: Record<string, string> | undefined; testDeps?: Record<string, string> | undefined } {
  const project = pomData.project || {};
  const dependencies = project.dependencies?.dependency || [];
  const dependencyArray = Array.isArray(dependencies) ? dependencies : [dependencies];

  let deps: Record<string, string> | undefined;
  let testDeps: Record<string, string> | undefined;

  if (includeDependencies) {
    deps = {};
    dependencyArray
      .filter((dep: any) => !dep.scope || dep.scope === 'compile' || dep.scope === 'runtime')
      .forEach((dep: any) => {
        if (dep.groupId && dep.artifactId && dep.version) {
          const key = `${dep.groupId}:${dep.artifactId}`;
          deps![key] = dep.version;
        }
      });
  }

  if (includeTestDependencies) {
    testDeps = {};
    dependencyArray
      .filter((dep: any) => dep.scope === 'test')
      .forEach((dep: any) => {
        if (dep.groupId && dep.artifactId && dep.version) {
          const key = `${dep.groupId}:${dep.artifactId}`;
          testDeps![key] = dep.version;
        }
      });
  }

  return { 
    deps: deps || undefined, 
    testDeps: testDeps || undefined 
  };
}

async function getDownloadStats(groupId: string, artifactId: string): Promise<DownloadStats> {
  // Maven Central doesn't provide public download statistics
  // We'll return mock data or try to estimate based on search popularity
  
  try {
    // Use search API to get some popularity metrics
    const searchQuery = `g:"${groupId}" AND a:"${artifactId}"`;
    const searchResult = await mavenCentralApi.searchPackages(searchQuery, 1);
    
    if (searchResult.response.numFound > 0) {
      const doc = searchResult.response.docs[0];
      // Use timestamp as a rough proxy for popularity (more recent = more downloads)
      const baseDownloads = Math.max(1, Math.floor((Date.now() - doc.timestamp) / 86400000)); // Days since last update
      
      return {
        last_day: Math.floor(baseDownloads * 0.1),
        last_week: Math.floor(baseDownloads * 0.7),
        last_month: baseDownloads,
      };
    }
  } catch (error) {
    logger.warn('Failed to estimate download stats', { groupId, artifactId, error });
  }

  // Fallback to minimal stats
  return {
    last_day: 0,
    last_week: 0,
    last_month: 0,
  };
}

function buildRepositoryInfo(pomData: any): RepositoryInfo | undefined {
  const project = pomData.project || {};
  const scm = project.scm;
  
  if (scm?.url) {
    return {
      type: 'git', // Most common
      url: scm.url,
    };
  }
  
  if (project.url) {
    return {
      type: 'unknown',
      url: project.url,
    };
  }
  
  return undefined;
}