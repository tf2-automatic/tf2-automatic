import { ConsoleLogger } from '@nestjs/common';
import {
  logs,
  SeverityNumber,
  type Logger as OtelLogger,
} from '@opentelemetry/api-logs';
import { getOtelConfig } from '@tf2-automatic/config';

type NestLevel = 'verbose' | 'debug' | 'log' | 'warn' | 'error' | 'fatal';

const SEVERITY: Record<NestLevel, { number: SeverityNumber; text: string }> = {
  verbose: { number: SeverityNumber.TRACE, text: 'TRACE' },
  debug: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  log: { number: SeverityNumber.INFO, text: 'INFO' },
  warn: { number: SeverityNumber.WARN, text: 'WARN' },
  error: { number: SeverityNumber.ERROR, text: 'ERROR' },
  fatal: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

/**
 * A drop-in replacement for Nest's `ConsoleLogger` that also emits every log
 * record to OpenTelemetry (when logs are enabled). Console output is unchanged,
 * so with OpenTelemetry disabled this behaves exactly like `ConsoleLogger`.
 *
 * Trace correlation is automatic: the Logs SDK stamps `trace_id`/`span_id` from
 * the active span at emit time, so once tracing is enabled these same log calls
 * carry correlation IDs with no code change.
 */
export class OtelLoggerService extends ConsoleLogger {
  private readonly emitEnabled = getOtelConfig().logs.enabled;
  private otelLogger: OtelLogger | undefined;

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message as string, ...(optionalParams as string[]));
    this.emitRecord('log', message, optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message as string, ...(optionalParams as string[]));
    this.emitRecord('error', message, optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message as string, ...(optionalParams as string[]));
    this.emitRecord('warn', message, optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message as string, ...(optionalParams as string[]));
    this.emitRecord('debug', message, optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message as string, ...(optionalParams as string[]));
    this.emitRecord('verbose', message, optionalParams);
  }

  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message as string, ...(optionalParams as string[]));
    this.emitRecord('fatal', message, optionalParams);
  }

  private getLogger(): OtelLogger {
    if (!this.otelLogger) {
      this.otelLogger = logs.getLogger('nestjs');
    }
    return this.otelLogger;
  }

  private emitRecord(
    level: NestLevel,
    message: unknown,
    params: unknown[],
  ): void {
    if (!this.emitEnabled) {
      return;
    }

    const severity = SEVERITY[level];

    let body: string;
    let stack: string | undefined;
    if (message instanceof Error) {
      body = message.message;
      stack = message.stack;
    } else {
      body = this.stringify(message);
    }

    // Nest passes the logging context as the trailing string argument.
    let context = this.context;
    const trailing = params[params.length - 1];
    if (typeof trailing === 'string') {
      context = trailing;
    }

    // For error/fatal, a leading string argument is the stack trace.
    if (
      !stack &&
      (level === 'error' || level === 'fatal') &&
      params.length > 1 &&
      typeof params[0] === 'string'
    ) {
      stack = params[0];
    }

    const attributes: Record<string, string> = {};
    if (context) {
      attributes['code.namespace'] = context;
    }
    if (stack) {
      attributes['exception.stacktrace'] = stack;
    }

    this.getLogger().emit({
      severityNumber: severity.number,
      severityText: severity.text,
      body,
      attributes,
    });
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
