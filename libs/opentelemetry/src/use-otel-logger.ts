import { INestApplication, LogLevel } from '@nestjs/common';
import { OtelLoggerService } from './logger.service';

export interface UseOtelLoggerOptions {
  /**
   * Enabled log levels. Omit to keep Nest's default levels (all levels),
   * preserving each app's existing console behavior.
   */
  logLevels?: LogLevel[];
}

/**
 * Install the OpenTelemetry-aware logger on the application and flush any logs
 * that were buffered during bootstrap.
 *
 * Use together with `NestFactory.create(AppModule, { bufferLogs: true })`.
 */
export function useOtelLogger(
  app: INestApplication,
  options: UseOtelLoggerOptions = {},
): void {
  const logger = options.logLevels
    ? new OtelLoggerService({ logLevels: options.logLevels })
    : new OtelLoggerService();
  app.useLogger(logger);
  app.flushLogs();
}
