import { initOpenTelemetry } from './sdk';

// Side-effect module. It MUST be imported as the very first line of each app's
// `main.ts` (before any other import) so the OpenTelemetry SDK installs its
// auto-instrumentation before the Nest application and its instrumented
// dependencies (http, express, ioredis, amqplib, ...) are loaded.
initOpenTelemetry();
