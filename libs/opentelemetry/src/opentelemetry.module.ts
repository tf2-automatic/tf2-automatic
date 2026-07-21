import {
  DynamicModule,
  Global,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { shutdownOtel } from './sdk';

@Injectable()
class OpenTelemetryShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    // Flush any buffered log/trace/metric batches on graceful shutdown.
    await shutdownOtel();
  }
}

/**
 * Registers the OpenTelemetry lifecycle with Nest. Its only job is to flush and
 * shut down the SDK when the application closes (via `enableShutdownHooks()` or
 * an explicit `app.close()`). Registering it is safe even when OpenTelemetry is
 * disabled — the shutdown call is then a no-op.
 */
@Global()
@Module({})
export class OpenTelemetryModule {
  static forRoot(): DynamicModule {
    return {
      module: OpenTelemetryModule,
      providers: [OpenTelemetryShutdownService],
    };
  }
}
