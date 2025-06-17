import {
  GetPackageReadmeParams,
  PackageReadmeResponse,
  InstallationInfo,
  PackageBasicInfo,
  RepositoryInfo,
  // PackageNotFoundError, // Currently unused
} from '../types/index.js';
import { Validators } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { mavenCentralApi } from '../services/maven-central-api.js';
import { githubApi, GitHubApi } from '../services/github-api.js';
import { ReadmeParser } from '../services/readme-parser.js';
import { cache, CacheService } from '../services/cache.js';

export async function getPackageReadme(params: GetPackageReadmeParams): Promise<PackageReadmeResponse> {
  const { package_name, version = 'latest', include_examples = true } = params;
  
  // Validate package name
  const { groupId, artifactId } = Validators.validatePackageName(package_name);
  
  logger.info('Getting package README', { groupId, artifactId, version, include_examples });

  // Check cache first
  const cacheKey = CacheService.generatePackageReadmeKey(groupId, artifactId, version);
  const cached = cache.get<PackageReadmeResponse>(cacheKey);
  if (cached) {
    logger.debug('Returning cached README', { groupId, artifactId, version });
    return cached;
  }

  try {
    // Get package info from Maven Central directly
    let packageInfo;
    
    try {
      logger.debug(`Getting package info for: ${groupId}:${artifactId}@${version}`);
      // Check if package exists first
      const packageExists = await mavenCentralApi.packageExists(groupId, artifactId);
      if (!packageExists) {
        throw new Error(`Package not found: ${groupId}:${artifactId}`);
      }
      
      // Get POM XML to extract package information
      const actualVersion = version === 'latest' 
        ? await mavenCentralApi.getLatestVersion(groupId, artifactId)
        : version;
      const pomXml = await mavenCentralApi.getPomXml(groupId, artifactId, actualVersion);
      
      // Create a mock package info object
      packageInfo = {
        groupId,
        artifactId,
        version: actualVersion,
        pomXml
      };
    } catch (error) {
      // If package not found, return a response indicating non-existence
      logger.debug(`Package not found: ${groupId}:${artifactId}`);
      
      const result: PackageReadmeResponse = {
        package_name: `${groupId}:${artifactId}`,
        version: version,
        description: 'Package not found',
        readme_content: '',
        usage_examples: [],
        installation: buildInstallationInfo(groupId, artifactId, version),
        basic_info: {
          groupId,
          artifactId,
          version,
          description: 'Package not found',
          license: 'Unknown',
          keywords: [],
        },
        exists: false,
      };
      
      return result;
    }
    
    logger.debug(`Package info retrieved for: ${groupId}:${artifactId}@${packageInfo.version}`);
    
    logger.debug(`Package found: ${groupId}:${artifactId}`);

    // Use the version already resolved above
    const resolvedVersion = packageInfo.version;
    
    // Get POM XML to extract basic info
    const pomXml = await mavenCentralApi.getPomXml(groupId, artifactId, resolvedVersion);
    const pomData = mavenCentralApi.parsePomXml(pomXml);
    
    // Build basic package info
    const basicInfo = buildBasicInfo(groupId, artifactId, resolvedVersion, pomData);
    
    // Get README content
    const readmeContent = await getReadmeContent(groupId, artifactId, pomData);
    
    // Extract usage examples
    const usageExamples = ReadmeParser.extractUsageExamples(readmeContent, include_examples);
    
    // Build installation info
    const installation = buildInstallationInfo(groupId, artifactId, resolvedVersion);
    
    // Build repository info
    const repository = buildRepositoryInfo(pomData);
    
    const result: PackageReadmeResponse = {
      package_name: `${groupId}:${artifactId}`,
      version: resolvedVersion,
      description: basicInfo.description,
      readme_content: ReadmeParser.cleanReadmeContent(readmeContent),
      usage_examples: usageExamples,
      installation,
      basic_info: basicInfo,
      repository,
      exists: true,
    };

    // Cache the result
    cache.set(cacheKey, result, 1800000); // 30 minutes cache
    
    logger.info('Package README retrieved successfully', { 
      groupId, 
      artifactId, 
      version: resolvedVersion,
      readmeLength: readmeContent.length,
      examples: usageExamples.length
    });

    return result;
  } catch (error) {
    logger.error('Failed to get package README', { groupId, artifactId, version, error });
    throw error;
  }
}

async function getReadmeContent(
  groupId: string, 
  artifactId: string, 
  pomData: any
): Promise<string> {
  // Try to get README from GitHub if repository info is available
  let readmeContent = '';
  
  // Extract repository URL from POM
  const scmUrl = pomData.project?.scm?.url || pomData.project?.url;
  if (scmUrl) {
    const githubInfo = GitHubApi.parseGitHubUrl(scmUrl);
    if (githubInfo) {
      try {
        logger.debug('Attempting to fetch README from GitHub', githubInfo);
        readmeContent = await githubApi.getReadme(githubInfo.owner, githubInfo.repo);
        logger.info('README fetched from GitHub', { 
          owner: githubInfo.owner, 
          repo: githubInfo.repo,
          length: readmeContent.length 
        });
      } catch (error) {
        logger.warn('Failed to fetch README from GitHub', { 
          owner: githubInfo.owner, 
          repo: githubInfo.repo, 
          error 
        });
      }
    }
  }

  // If no README from GitHub, create a basic one from POM info
  if (!readmeContent) {
    readmeContent = generateBasicReadme(groupId, artifactId, pomData);
    logger.debug('Generated basic README from POM data', { groupId, artifactId });
  }

  return readmeContent;
}

function generateBasicReadme(groupId: string, artifactId: string, pomData: any): string {
  const project = pomData.project || {};
  const name = project.name || `${groupId}:${artifactId}`;
  const description = project.description || 'No description available';
  const url = project.url || '';

  return `# ${name}

${description}

## Installation

### Maven

\`\`\`xml
<dependency>
    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>VERSION</version>
</dependency>
\`\`\`

### Gradle

\`\`\`gradle
implementation '${groupId}:${artifactId}:VERSION'
\`\`\`

${url ? `## More Information\n\nVisit: ${url}\n` : ''}

## Usage

Please refer to the official documentation for usage examples.
`;
}

function buildBasicInfo(
  groupId: string, 
  artifactId: string, 
  version: string, 
  pomData: any
): PackageBasicInfo {
  const project = pomData.project || {};
  
  // Extract license info
  let license = 'Unknown';
  if (project.licenses?.license) {
    const licenses = Array.isArray(project.licenses.license) 
      ? project.licenses.license 
      : [project.licenses.license];
    license = licenses.map((l: any) => l.name).join(', ');
  }

  // Extract organization info
  const organization = project.organization?.name;

  // Extract developers
  const developers = project.developers?.developer || [];
  const developersArray = Array.isArray(developers) ? developers : [developers];

  return {
    groupId,
    artifactId,
    version,
    description: project.description || 'No description available',
    packaging: project.packaging || 'jar',
    homepage: project.url,
    license,
    organization,
    developers: developersArray.map((dev: any) => ({
      name: dev.name || 'Unknown',
      email: dev.email,
      url: dev.url,
    })),
    keywords: [], // Maven doesn't have keywords like npm
  };
}

function buildInstallationInfo(groupId: string, artifactId: string, version: string): InstallationInfo {
  const mavenXml = `<dependency>
    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>${version}</version>
</dependency>`;

  const gradleGroovy = `implementation '${groupId}:${artifactId}:${version}'`;
  const sbtScala = `libraryDependencies += "${groupId}" % "${artifactId}" % "${version}"`;

  return {
    maven: mavenXml,
    gradle: gradleGroovy,
    sbt: sbtScala,
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