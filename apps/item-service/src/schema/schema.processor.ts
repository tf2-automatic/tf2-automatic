import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { bullWorkerSettings } from '../common/utils/backoff-strategy';
import { SchemaService } from './schema.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BotsService } from '../bots/bots.service';
import {
  JobWithTypes as Job,
  GetSchemaItemsResponse,
  GetSchemaOverviewResponse,
} from './schema.types';
import configuration from '../common/config/configuration';

@Processor('schema', {
  settings: bullWorkerSettings,
  concurrency: 1,
  limiter: {
    max: 1,
    duration: configuration().schema.limiterDuration,
  },
})
export class SchemaProcessor extends WorkerHost {
  private readonly logger = new Logger(SchemaProcessor.name);

  constructor(
    private readonly schemaService: SchemaService,
    private readonly botsService: BotsService,
    private readonly httpService: HttpService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    let processor: (job: Job, apiKey: string) => Promise<void>;

    switch (job.name) {
      case 'schema':
        processor = this.updateSchema.bind(this);
        break;
      case 'items':
        processor = this.updateItems.bind(this);
        break;
      default:
        this.logger.error(`Unknown job name: ${job.name}`);
        return;
    }

    this.logger.debug('Processing job ' + job.name + ' #' + job.id + '...');

    const apiKey = await this.botsService.getApiKey();
    await processor(job, apiKey);
  }

  private async updateSchema(job: Job, apiKey: string) {
    const result = await this.getSchemaOverview(apiKey);
    await this.schemaService.updateOverview(job, result);
  }

  private async updateItems(job: Job, apiKey: string) {
    const result = await this.getSchemaItems(apiKey, job.data.start);
    await this.schemaService.updateItems(job, result);
  }

  private async getSchemaOverview(
    apiKey: string,
  ): Promise<GetSchemaOverviewResponse> {
    const response = await firstValueFrom(
      this.httpService.get(
        'https://api.steampowered.com/IEconItems_440/GetSchemaOverview/v0001/',
        {
          params: {
            key: apiKey,
            language: 'English',
          },
          responseType: 'json',
        },
      ),
    );

    return response.data.result;
  }

  private async getSchemaItems(
    apiKey: string,
    start = 0,
  ): Promise<GetSchemaItemsResponse> {
    const response = await firstValueFrom(
      this.httpService.get(
        'https://api.steampowered.com/IEconItems_440/GetSchemaItems/v1/',
        {
          params: {
            key: apiKey,
            start,
            language: 'English',
          },
          responseType: 'json',
        },
      ),
    );

    return response.data.result;
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  private onFailed(job: Job, err: Error): void {
    this.logger.warn(`Failed job ${job.id}: ${err.message}`);
  }
}
