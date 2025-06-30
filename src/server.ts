import { BasePackageServer, ToolDefinition } from '@elchika-inc/package-readme-shared';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getPackageReadme } from './tools/get-package-readme.js';
import { getPackageInfo } from './tools/get-package-info.js';
import { searchPackages } from './tools/search-packages.js';
import { ParameterValidator } from './utils/parameter-validator.js';
import { logger } from './utils/logger.js';

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_readme_from_maven: {
    name: 'get_readme_from_maven',
    description: 'Get package README and usage examples from Maven Central',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the Maven package in groupId:artifactId format (e.g., org.springframework:spring-core)',
        },
        version: {
          type: 'string',
          description: 'The version of the package (default: "latest")',
          default: 'latest',
        },
        include_examples: {
          type: 'boolean',
          description: 'Whether to include usage examples (default: true)',
          default: true,
        }
      },
      required: ['package_name'],
    }
  },
  get_package_info_from_maven: {
    name: 'get_package_info_from_maven',
    description: 'Get package basic information and dependencies from Maven Central',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: {
          type: 'string',
          description: 'The name of the Maven package in groupId:artifactId format (e.g., org.springframework:spring-core)',
        },
        include_dependencies: {
          type: 'boolean',
          description: 'Whether to include dependencies (default: true)',
          default: true,
        },
        include_dev_dependencies: {
          type: 'boolean',
          description: 'Whether to include test dependencies (default: false)',
          default: false,
        }
      },
      required: ['package_name'],
    }
  },
  search_packages_from_maven: {
    name: 'search_packages_from_maven',
    description: 'Search for packages in Maven Central',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (can include groupId, artifactId, or description terms)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
          default: 20,
          minimum: 1,
          maximum: 250,
        },
        quality: {
          type: 'number',
          description: 'Minimum quality score (0-1)',
          minimum: 0,
          maximum: 1,
        },
        popularity: {
          type: 'number',
          description: 'Minimum popularity score (0-1)',
          minimum: 0,
          maximum: 1,
        }
      },
      required: ['query'],
    }
  },
} as const;

export class MavenPackageReadmeMcpServer extends BasePackageServer {
  constructor() {
    super({
      name: 'maven-package-readme-mcp',
      version: '1.0.0',
    });
  }

  protected getToolDefinitions(): Record<string, ToolDefinition> {
    return TOOL_DEFINITIONS;
  }

  protected async handleToolCall(name: string, args: unknown): Promise<unknown> {
    try {
      switch (name) {
        case 'get_readme_from_maven':
          return await getPackageReadme(ParameterValidator.validateGetPackageReadmeParams(args));
        
        case 'get_package_info_from_maven':
          return await getPackageInfo(ParameterValidator.validateGetPackageInfoParams(args));
        
        case 'search_packages_from_maven':
          return await searchPackages(ParameterValidator.validateSearchPackagesParams(args));
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, { error });
      throw error;
    }
  }

  private mapErrorCode(code: string): ErrorCode {
    switch (code) {
      case 'PACKAGE_NOT_FOUND':
      case 'VERSION_NOT_FOUND':
        return ErrorCode.InvalidRequest;
      case 'INVALID_PACKAGE_NAME':
      case 'INVALID_VERSION':
      case 'INVALID_SEARCH_QUERY':
      case 'INVALID_LIMIT':
      case 'INVALID_SCORE':
        return ErrorCode.InvalidParams;
      case 'RATE_LIMIT_EXCEEDED':
        return ErrorCode.InternalError;
      case 'NETWORK_ERROR':
        return ErrorCode.InternalError;
      default:
        return ErrorCode.InternalError;
    }
  }

  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await (this.server as any).connect(transport);
    } catch (error) {
      logger.error('Failed to start server transport', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    await (this.server as any).close();
  }
}

export default MavenPackageReadmeMcpServer;