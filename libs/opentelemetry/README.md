# opentelemetry

Optional OpenTelemetry integration for the tf2-automatic services.

OpenTelemetry is **opt-in** and defaults to **off** — existing deployments are
unaffected unless `OTEL_ENABLED=true` is set. See `@tf2-automatic/config`'s
`getOtelConfig()` for the full list of `OTEL_*` environment variables.

## Usage

Import the side-effect module as the **very first line** of the app's `main.ts`
(before any other import), so the SDK can install its instrumentation before the
Nest application and its dependencies are loaded:

```ts
import '@tf2-automatic/opentelemetry/instrumentation';
// ...other imports
```

Then bridge Nest's logger and register the shutdown module:

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
useOtelLogger(app);
```

```ts
@Module({ imports: [OpenTelemetryModule.forRoot()] })
export class AppModule {}
```

## Building

Run `nx build opentelemetry` to build the library.
