import { PackageReadmeMcpError, NetworkError, RateLimitError } from '../types/index.js';
import { logger } from './logger.js';

export class ErrorHandler {
  static handleApiError(error: unknown, context: string): never {
    logger.error(`API error in ${context}`, { error });

    if (error instanceof PackageReadmeMcpError) {
      throw error;
    }

    if (error instanceof Error) {
      // Handle fetch errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new NetworkError(`Failed to fetch data from ${context}`, error);
      }

      // Handle timeout errors
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new NetworkError(`Request timeout for ${context}`, error);
      }

      // Handle rate limit errors (common HTTP status codes)
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        throw new RateLimitError(context);
      }

      // Generic network error
      throw new NetworkError(error.message, error);
    }

    // Unknown error
    throw new PackageReadmeMcpError(
      `Unknown error in ${context}: ${String(error)}`,
      'UNKNOWN_ERROR'
    );
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context: string = 'operation'
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx except 429)
        if (error instanceof PackageReadmeMcpError) {
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
            throw error;
          }
        }

        if (attempt === maxRetries) {
          logger.error(`All retry attempts failed for ${context}`, {
            attempts: maxRetries,
            lastError: error
          });
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`Retry attempt ${attempt}/${maxRetries} for ${context} after ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.handleApiError(lastError, context);
  }

  static isRetryableError(error: unknown): boolean {
    if (error instanceof RateLimitError) {
      return true;
    }

    if (error instanceof NetworkError) {
      return true;
    }

    if (error instanceof PackageReadmeMcpError) {
      return error.statusCode === 429 || (error.statusCode !== undefined && error.statusCode >= 500);
    }

    return false;
  }
}