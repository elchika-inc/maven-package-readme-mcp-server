import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  GetPackageReadmeParams,
  GetPackageInfoParams,
  SearchPackagesParams,
} from '../types/index.js';

export class ParameterValidator {
  static validateGetPackageReadmeParams(args: unknown): GetPackageReadmeParams {
    if (!args || typeof args !== 'object') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments must be an object'
      );
    }

    const params = args as Record<string, unknown>;

    if (!params.package_name || typeof params.package_name !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'package_name is required and must be a string in groupId:artifactId format'
      );
    }

    if (params.version !== undefined && typeof params.version !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'version must be a string'
      );
    }

    if (params.include_examples !== undefined && typeof params.include_examples !== 'boolean') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'include_examples must be a boolean'
      );
    }

    const result: GetPackageReadmeParams = {
      package_name: params.package_name,
    };
    
    if (params.version !== undefined) {
      result.version = params.version as string;
    }
    
    if (params.include_examples !== undefined) {
      result.include_examples = params.include_examples as boolean;
    }
    
    return result;
  }

  static validateGetPackageInfoParams(args: unknown): GetPackageInfoParams {
    if (!args || typeof args !== 'object') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments must be an object'
      );
    }

    const params = args as Record<string, unknown>;

    if (!params.package_name || typeof params.package_name !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'package_name is required and must be a string in groupId:artifactId format'
      );
    }

    if (params.include_dependencies !== undefined && typeof params.include_dependencies !== 'boolean') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'include_dependencies must be a boolean'
      );
    }

    if (params.include_dev_dependencies !== undefined && typeof params.include_dev_dependencies !== 'boolean') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'include_dev_dependencies must be a boolean'
      );
    }

    const result: GetPackageInfoParams = {
      package_name: params.package_name,
    };
    
    if (params.include_dependencies !== undefined) {
      result.include_dependencies = params.include_dependencies as boolean;
    }
    
    if (params.include_dev_dependencies !== undefined) {
      result.include_dev_dependencies = params.include_dev_dependencies as boolean;
    }
    
    return result;
  }

  static validateSearchPackagesParams(args: unknown): SearchPackagesParams {
    if (!args || typeof args !== 'object') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments must be an object'
      );
    }

    const params = args as Record<string, unknown>;

    if (!params.query || typeof params.query !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'query is required and must be a string'
      );
    }

    if (params.limit !== undefined) {
      if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 250) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'limit must be a number between 1 and 250'
        );
      }
    }

    if (params.quality !== undefined) {
      if (typeof params.quality !== 'number' || params.quality < 0 || params.quality > 1) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'quality must be a number between 0 and 1'
        );
      }
    }

    if (params.popularity !== undefined) {
      if (typeof params.popularity !== 'number' || params.popularity < 0 || params.popularity > 1) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'popularity must be a number between 0 and 1'
        );
      }
    }

    const result: SearchPackagesParams = {
      query: params.query,
    };
    
    if (params.limit !== undefined) {
      result.limit = params.limit as number;
    }
    
    if (params.quality !== undefined) {
      result.quality = params.quality as number;
    }
    
    if (params.popularity !== undefined) {
      result.popularity = params.popularity as number;
    }
    
    return result;
  }
}