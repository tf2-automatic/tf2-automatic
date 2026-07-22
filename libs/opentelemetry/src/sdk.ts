import type { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { getOtelConfig } from '@tf2-automatic/config';

let sdk: NodeSDK | undefined;
let started = false;
let shuttingDown = false;

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Build the full URL for an OTLP signal. A per-signal override is used verbatim
 * (standard OTEL semantics); otherwise the signal path is appended to the base
 * endpoint.
 */
function signalUrl(base: string, path: string, override?: string): string {
  const url = override ? override : stripTrailingSlash(base) + path;
  console.log(`[otel] exporter endpoint: ${url}`);
  return url;
}

/**
 * Initialize the OpenTelemetry Node SDK from the environment.
 *
 * Must run before the Nest application (and its instrumented dependencies) are
 * loaded, which is why it is invoked from the `instrumentation` side-effect
 * module imported first in each app's `main.ts`.
 *
 * When OpenTelemetry is disabled this is a cheap no-op and none of the
 * `@opentelemetry/*` packages are loaded (they are required lazily below).
 */
export function initOpenTelemetry(): void {
  if (started) {
    return;
  }

  const config = getOtelConfig();
  if (!config.enabled) {
    return;
  }

  started = true;

  // Required lazily so disabled deployments never load these packages.
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { resourceFromAttributes } = require('@opentelemetry/resources');
  const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
  } = require('@opentelemetry/semantic-conventions');
  const {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
  } = require('@opentelemetry/api');

  // Surface exporter/SDK problems (e.g. an unreachable collector) instead of
  // failing silently.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const attributes: Record<string, string> = {};
  if (config.serviceName) {
    attributes[ATTR_SERVICE_NAME] = config.serviceName;
  }
  if (config.serviceVersion) {
    attributes[ATTR_SERVICE_VERSION] = config.serviceVersion;
  }

  const options: Partial<NodeSDKConfiguration> = {
    resource: resourceFromAttributes(attributes),
  };

  if (config.logs.enabled) {
    const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
    const {
      OTLPLogExporter,
    } = require('@opentelemetry/exporter-logs-otlp-proto');
    options.logRecordProcessors = [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: signalUrl(config.endpoint, '/v1/logs', config.logs.endpoint),
          headers: config.headers,
        }),
      }),
    ];
  }

  if (config.traces.enabled) {
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-proto');
    const {
      ParentBasedSampler,
      TraceIdRatioBasedSampler,
    } = require('@opentelemetry/sdk-trace-node');
    options.traceExporter = new OTLPTraceExporter({
      url: signalUrl(config.endpoint, '/v1/traces', config.traces.endpoint),
      headers: config.headers,
    });
    options.sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(config.traces.samplerArg),
    });
  }

  if (config.metrics.enabled) {
    const {
      PeriodicExportingMetricReader,
    } = require('@opentelemetry/sdk-metrics');
    const {
      OTLPMetricExporter,
    } = require('@opentelemetry/exporter-metrics-otlp-proto');
    options.metricReaders = [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: signalUrl(
            config.endpoint,
            '/v1/metrics',
            config.metrics.endpoint,
          ),
          headers: config.headers,
        }),
        exportIntervalMillis: config.metrics.exportIntervalMillis,
      }),
    ];
  }

  // Auto-instrumentation feeds both traces and metrics, so register it whenever
  // either signal is enabled — e.g. HTTP server/client duration histograms are
  // produced by instrumentation-http even when tracing is off.
  if (config.traces.enabled || config.metrics.enabled) {
    options.instrumentations = createInstrumentations();
  }

  // When tracing is disabled, explicitly register no span processors. Without
  // this, NodeSDK falls back to `getSpanProcessorsFromEnv()`, which defaults
  // `OTEL_TRACES_EXPORTER` to `otlp` and sets up a default OTLP trace exporter.
  // The instrumentations above would then emit spans that get exported to an
  // endpoint that isn't accepting traces, spamming the console with errors.
  // An empty array makes NodeSDK skip the TracerProvider entirely, so spans go
  // to a no-op tracer while instrumentation metrics still flow.
  if (!config.traces.enabled) {
    options.spanProcessors = [];
  }

  const instance: NodeSDK = new NodeSDK(options);
  instance.start();
  sdk = instance;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createInstrumentations(): any[] {
  const {
    HttpInstrumentation,
  } = require('@opentelemetry/instrumentation-http');
  const {
    ExpressInstrumentation,
  } = require('@opentelemetry/instrumentation-express');
  const {
    NestInstrumentation,
  } = require('@opentelemetry/instrumentation-nestjs-core');
  const {
    IORedisInstrumentation,
  } = require('@opentelemetry/instrumentation-ioredis');
  const {
    AmqplibInstrumentation,
  } = require('@opentelemetry/instrumentation-amqplib');

  return [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    new IORedisInstrumentation(),
    new AmqplibInstrumentation(),
  ];
}

/**
 * Flush and shut down the SDK. Safe to call multiple times and when the SDK was
 * never started. Invoked from the Nest `OnApplicationShutdown` hook so buffered
 * batches are not lost on a graceful stop.
 */
export async function shutdownOtel(): Promise<void> {
  if (!sdk || shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await sdk.shutdown();
  } catch {
    // We are shutting down anyway; nothing useful to do with the error.
  }
}
