import {
  SearchPackagesParams,
  SearchPackagesResponse,
  PackageSearchResult,
} from '../types/index.js';
import { Validators } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { mavenCentralApi } from '../services/maven-central-api.js';
import { cache, CacheService } from '../services/cache.js';

export async function searchPackages(params: SearchPackagesParams): Promise<SearchPackagesResponse> {
  const { query, limit = 20, quality, popularity } = params;
  
  // Validate parameters
  if (!Validators.validateSearchQuery(query)) {
    throw new Error('Invalid search query');
  }
  
  if (!Validators.validateLimit(limit)) {
    throw new Error('Invalid limit value');
  }
  
  if (quality !== undefined && !Validators.validateScore(quality)) {
    throw new Error('Invalid quality score');
  }
  
  if (popularity !== undefined && !Validators.validateScore(popularity)) {
    throw new Error('Invalid popularity score');
  }

  logger.info('Searching packages', { query, limit, quality, popularity });

  // Check cache first
  const cacheKey = CacheService.generateSearchKey(query, limit, quality, popularity);
  const cached = cache.get<SearchPackagesResponse>(cacheKey);
  if (cached) {
    logger.debug('Returning cached search results', { query, limit });
    return cached;
  }

  try {
    // Perform search
    const searchResult = await mavenCentralApi.searchPackages(query, limit);
    
    // Convert search results to our format
    const packages: PackageSearchResult[] = searchResult.response.docs.map(doc => {
      // Calculate scores (simplified since Maven Central doesn't provide quality metrics)
      const score = calculatePackageScore(doc);
      
      return {
        groupId: doc.g,
        artifactId: doc.a,
        version: doc.v || doc.latestVersion || 'unknown',
        description: extractDescription(doc),
        keywords: doc.tags || [],
        organization: extractOrganization(doc.g),
        repositoryId: 'central',
        score: {
          final: score.final,
          detail: {
            quality: score.quality,
            popularity: score.popularity,
            maintenance: score.maintenance,
          },
        },
        searchScore: score.final,
      };
    });

    // Filter by quality and popularity if specified
    const filteredPackages = packages.filter(pkg => {
      if (quality !== undefined && pkg.score.detail.quality < quality) {
        return false;
      }
      if (popularity !== undefined && pkg.score.detail.popularity < popularity) {
        return false;
      }
      return true;
    });

    const result: SearchPackagesResponse = {
      query,
      total: Math.min(searchResult.response.numFound, filteredPackages.length),
      packages: filteredPackages,
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, result, 300000);
    
    logger.info('Package search completed', { 
      query, 
      totalFound: searchResult.response.numFound,
      returned: filteredPackages.length,
      filtered: packages.length - filteredPackages.length
    });

    return result;
  } catch (error) {
    logger.error('Failed to search packages', { query, limit, error });
    throw error;
  }
}

function calculatePackageScore(doc: any): {
  final: number;
  quality: number;
  popularity: number;
  maintenance: number;
} {
  // Since Maven Central doesn't provide quality metrics like npm,
  // we'll use heuristics based on available data
  
  // Quality heuristic: based on groupId structure and naming conventions
  const quality = calculateQualityScore(doc);
  
  // Popularity heuristic: based on recency and search relevance
  const popularity = calculatePopularityScore(doc);
  
  // Maintenance heuristic: based on how recent the version is
  const maintenance = calculateMaintenanceScore(doc);
  
  const final = (quality * 0.3 + popularity * 0.4 + maintenance * 0.3);
  
  return {
    final: Math.round(final * 100) / 100,
    quality: Math.round(quality * 100) / 100,
    popularity: Math.round(popularity * 100) / 100,
    maintenance: Math.round(maintenance * 100) / 100,
  };
}

function calculateQualityScore(doc: any): number {
  let score = 0.5; // Base score
  
  const groupId = doc.g || '';
  // const artifactId = doc.a || ''; // Currently unused
  
  // Higher score for well-known organizations
  const wellKnownOrgs = [
    'org.springframework', 'com.google', 'org.apache', 'com.fasterxml',
    'org.eclipse', 'com.squareup', 'io.netty', 'org.hibernate',
    'org.slf4j', 'ch.qos.logback', 'junit', 'org.junit',
    'org.mockito', 'com.github.ben-manes.caffeine'
  ];
  
  if (wellKnownOrgs.some(org => groupId.startsWith(org))) {
    score += 0.3;
  }
  
  // Higher score for reverse domain naming convention
  if (groupId.includes('.') && groupId.split('.').length >= 2) {
    score += 0.1;
  }
  
  // Lower score for snapshot versions
  if (doc.v && doc.v.includes('SNAPSHOT')) {
    score -= 0.1;
  }
  
  // Higher score for semantic versioning
  if (doc.v && /^\d+\.\d+\.\d+$/.test(doc.v)) {
    score += 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
}

function calculatePopularityScore(doc: any): number {
  let score = 0.3; // Base score
  
  // Use timestamp as a proxy for activity/popularity
  if (doc.timestamp) {
    const daysSinceUpdate = (Date.now() - doc.timestamp) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < 30) {
      score += 0.4; // Very recent
    } else if (daysSinceUpdate < 180) {
      score += 0.3; // Recent
    } else if (daysSinceUpdate < 365) {
      score += 0.2; // Moderately recent
    } else if (daysSinceUpdate < 730) {
      score += 0.1; // Somewhat old
    }
    // Very old packages get no bonus
  }
  
  // Bonus for commonly used artifacts
  const commonArtifacts = [
    'spring-core', 'spring-boot', 'guava', 'jackson-core',
    'slf4j-api', 'logback-classic', 'junit-jupiter', 'mockito-core'
  ];
  
  if (commonArtifacts.includes(doc.a)) {
    score += 0.3;
  }
  
  return Math.max(0, Math.min(1, score));
}

function calculateMaintenanceScore(doc: any): number {
  if (!doc.timestamp) {
    return 0.2; // Low score for unknown update time
  }
  
  const daysSinceUpdate = (Date.now() - doc.timestamp) / (1000 * 60 * 60 * 24);
  
  if (daysSinceUpdate < 30) {
    return 1.0; // Excellent maintenance
  } else if (daysSinceUpdate < 90) {
    return 0.8; // Good maintenance
  } else if (daysSinceUpdate < 365) {
    return 0.6; // Fair maintenance
  } else if (daysSinceUpdate < 730) {
    return 0.4; // Poor maintenance
  } else {
    return 0.2; // Very poor maintenance
  }
}

function extractDescription(doc: any): string {
  // Maven Central search doesn't typically return descriptions
  // We can try to infer or return a default
  if (doc.text && Array.isArray(doc.text)) {
    const descriptionText = doc.text.find((text: string) => 
      text.length > 10 && !text.includes(':') && !text.includes('/')
    );
    if (descriptionText) {
      return descriptionText;
    }
  }
  
  // Generate a basic description
  return `Maven package ${doc.g}:${doc.a}`;
}

function extractOrganization(groupId: string): string {
  if (!groupId) return 'Unknown';
  
  // Extract organization from groupId
  const parts = groupId.split('.');
  
  if (parts.length >= 2) {
    // For reverse domain names like com.google.guava
    if (parts[0] === 'com' || parts[0] === 'org' || parts[0] === 'net' || parts[0] === 'io') {
      return parts.slice(0, 2).join('.');
    }
  }
  
  return parts[0] || 'Unknown';
}