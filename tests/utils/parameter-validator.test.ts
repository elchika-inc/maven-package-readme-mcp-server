import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ParameterValidator } from '../../src/utils/parameter-validator.js';

describe('ParameterValidator', () => {
  describe('validateGetPackageReadmeParams', () => {
    it('should validate valid minimal parameters', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact'
      };

      // Act
      const result = ParameterValidator.validateGetPackageReadmeParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact'
      });
    });

    it('should validate valid parameters with all optional fields', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        version: '1.0.0',
        include_examples: true
      };

      // Act
      const result = ParameterValidator.validateGetPackageReadmeParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact',
        version: '1.0.0',
        include_examples: true
      });
    });

    it('should validate parameters with include_examples as false', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        include_examples: false
      };

      // Act
      const result = ParameterValidator.validateGetPackageReadmeParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact',
        include_examples: false
      });
    });

    it('should throw error when args is null', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(null))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Arguments must be an object'));
    });

    it('should throw error when args is undefined', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(undefined))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Arguments must be an object'));
    });

    it('should throw error when args is not an object', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams('string'))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Arguments must be an object'));
    });

    it('should throw error when package_name is missing', () => {
      // Arrange
      const args = {
        version: '1.0.0'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'package_name is required and must be a string in groupId:artifactId format'));
    });

    it('should throw error when package_name is not a string', () => {
      // Arrange
      const args = {
        package_name: 123
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'package_name is required and must be a string in groupId:artifactId format'));
    });

    it('should throw error when package_name is empty string', () => {
      // Arrange
      const args = {
        package_name: ''
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'package_name is required and must be a string in groupId:artifactId format'));
    });

    it('should throw error when version is not a string', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        version: 123
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'version must be a string'));
    });

    it('should throw error when include_examples is not a boolean', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        include_examples: 'true'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'include_examples must be a boolean'));
    });

    it('should handle empty version string', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        version: ''
      };

      // Act
      const result = ParameterValidator.validateGetPackageReadmeParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact',
        version: ''
      });
    });
  });

  describe('validateGetPackageInfoParams', () => {
    it('should validate valid minimal parameters', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact'
      };

      // Act
      const result = ParameterValidator.validateGetPackageInfoParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact'
      });
    });

    it('should validate valid parameters with all optional fields', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        include_dependencies: true,
        include_dev_dependencies: false
      };

      // Act
      const result = ParameterValidator.validateGetPackageInfoParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact',
        include_dependencies: true,
        include_dev_dependencies: false
      });
    });

    it('should throw error when args is null', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageInfoParams(null))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Arguments must be an object'));
    });

    it('should throw error when package_name is missing', () => {
      // Arrange
      const args = {
        include_dependencies: true
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageInfoParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'package_name is required and must be a string in groupId:artifactId format'));
    });

    it('should throw error when include_dependencies is not a boolean', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        include_dependencies: 'true'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageInfoParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'include_dependencies must be a boolean'));
    });

    it('should throw error when include_dev_dependencies is not a boolean', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        include_dev_dependencies: 'false'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageInfoParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'include_dev_dependencies must be a boolean'));
    });

    it('should handle both dependency flags as false', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        include_dependencies: false,
        include_dev_dependencies: false
      };

      // Act
      const result = ParameterValidator.validateGetPackageInfoParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact',
        include_dependencies: false,
        include_dev_dependencies: false
      });
    });
  });

  describe('validateSearchPackagesParams', () => {
    it('should validate valid minimal parameters', () => {
      // Arrange
      const args = {
        query: 'spring boot'
      };

      // Act
      const result = ParameterValidator.validateSearchPackagesParams(args);

      // Assert
      expect(result).toEqual({
        query: 'spring boot'
      });
    });

    it('should validate valid parameters with all optional fields', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        limit: 10,
        quality: 0.8,
        popularity: 0.7
      };

      // Act
      const result = ParameterValidator.validateSearchPackagesParams(args);

      // Assert
      expect(result).toEqual({
        query: 'spring boot',
        limit: 10,
        quality: 0.8,
        popularity: 0.7
      });
    });

    it('should throw error when args is null', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(null))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Arguments must be an object'));
    });

    it('should throw error when query is missing', () => {
      // Arrange
      const args = {
        limit: 10
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'query is required and must be a string'));
    });

    it('should throw error when query is not a string', () => {
      // Arrange
      const args = {
        query: 123
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'query is required and must be a string'));
    });

    it('should throw error when query is empty string', () => {
      // Arrange
      const args = {
        query: ''
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'query is required and must be a string'));
    });

    it('should throw error when limit is not a number', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        limit: '10'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'limit must be a number between 1 and 250'));
    });

    it('should throw error when limit is less than 1', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        limit: 0
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'limit must be a number between 1 and 250'));
    });

    it('should throw error when limit is greater than 250', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        limit: 251
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'limit must be a number between 1 and 250'));
    });

    it('should accept limit boundary values', () => {
      // Arrange & Act & Assert
      const minArgs = { query: 'test', limit: 1 };
      const maxArgs = { query: 'test', limit: 250 };

      expect(() => ParameterValidator.validateSearchPackagesParams(minArgs)).not.toThrow();
      expect(() => ParameterValidator.validateSearchPackagesParams(maxArgs)).not.toThrow();
    });

    it('should throw error when quality is not a number', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        quality: '0.8'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'quality must be a number between 0 and 1'));
    });

    it('should throw error when quality is less than 0', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        quality: -0.1
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'quality must be a number between 0 and 1'));
    });

    it('should throw error when quality is greater than 1', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        quality: 1.1
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'quality must be a number between 0 and 1'));
    });

    it('should accept quality boundary values', () => {
      // Arrange & Act & Assert
      const minArgs = { query: 'test', quality: 0 };
      const maxArgs = { query: 'test', quality: 1 };

      expect(() => ParameterValidator.validateSearchPackagesParams(minArgs)).not.toThrow();
      expect(() => ParameterValidator.validateSearchPackagesParams(maxArgs)).not.toThrow();
    });

    it('should throw error when popularity is not a number', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        popularity: '0.7'
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'popularity must be a number between 0 and 1'));
    });

    it('should throw error when popularity is less than 0', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        popularity: -0.1
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'popularity must be a number between 0 and 1'));
    });

    it('should throw error when popularity is greater than 1', () => {
      // Arrange
      const args = {
        query: 'spring boot',
        popularity: 1.1
      };

      // Act & Assert
      expect(() => ParameterValidator.validateSearchPackagesParams(args))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'popularity must be a number between 0 and 1'));
    });

    it('should accept popularity boundary values', () => {
      // Arrange & Act & Assert
      const minArgs = { query: 'test', popularity: 0 };
      const maxArgs = { query: 'test', popularity: 1 };

      expect(() => ParameterValidator.validateSearchPackagesParams(minArgs)).not.toThrow();
      expect(() => ParameterValidator.validateSearchPackagesParams(maxArgs)).not.toThrow();
    });

    it('should handle floating point numbers correctly', () => {
      // Arrange
      const args = {
        query: 'test',
        quality: 0.333333,
        popularity: 0.666666
      };

      // Act
      const result = ParameterValidator.validateSearchPackagesParams(args);

      // Assert
      expect(result.quality).toBeCloseTo(0.333333);
      expect(result.popularity).toBeCloseTo(0.666666);
    });
  });

  describe('edge cases and type handling', () => {
    it('should handle objects with extra properties', () => {
      // Arrange
      const args = {
        package_name: 'com.example:test-artifact',
        extra_property: 'should be ignored',
        another_extra: 123
      };

      // Act
      const result = ParameterValidator.validateGetPackageReadmeParams(args);

      // Assert
      expect(result).toEqual({
        package_name: 'com.example:test-artifact'
      });
    });

    it('should handle arrays as invalid arguments', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams([]))
        .toThrow('Arguments must be an object');
    });

    it('should handle functions as invalid arguments', () => {
      // Act & Assert
      expect(() => ParameterValidator.validateGetPackageReadmeParams(() => {}))
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Arguments must be an object'));
    });

    it('should handle zero values correctly for numbers', () => {
      // Arrange
      const args = {
        query: 'test',
        limit: 1,
        quality: 0,
        popularity: 0
      };

      // Act
      const result = ParameterValidator.validateSearchPackagesParams(args);

      // Assert
      expect(result).toEqual({
        query: 'test',
        limit: 1,
        quality: 0,
        popularity: 0
      });
    });

    it('should handle whitespace in query strings', () => {
      // Arrange
      const args = {
        query: '  spring boot  '
      };

      // Act
      const result = ParameterValidator.validateSearchPackagesParams(args);

      // Assert
      expect(result.query).toBe('  spring boot  ');
    });

    it('should handle special characters in package names', () => {
      // Arrange
      const args = {
        package_name: 'com.example-test:my-artifact_v2'
      };

      // Act
      const result = ParameterValidator.validateGetPackageReadmeParams(args);

      // Assert
      expect(result.package_name).toBe('com.example-test:my-artifact_v2');
    });
  });
});