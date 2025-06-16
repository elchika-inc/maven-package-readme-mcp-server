export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

class ConsoleLogger implements Logger {
  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'info') {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage('error', message, meta));
  }
}

export const logger: Logger = new ConsoleLogger();