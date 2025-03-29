import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { SchemaService } from './schema.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BotsService } from '../bots/bots.service';
import {
  JobWithTypes as Job,
  GetSchemaItemsResponse,
  SchemaOverviewResponse,
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
    let processor: (job: Job) => Promise<void>;

    switch (job.name) {
      case 'schema':
        processor = this.updateSchema.bind(this);
        break;
      case 'url':
        processor = this.updateUrl.bind(this);
        break;
      case 'overview':
        processor = this.updateSchemaOverview.bind(this);
        break;
      case 'items':
        processor = this.updateItems.bind(this);
        break;
      case 'proto_obj_defs':
        processor = this.updateProtoObjDefs.bind(this);
        break;
      case 'items_game':
        processor = this.updateItemsGame.bind(this);
        break;
      default:
        this.logger.error(`Unknown job name: ${job.name}`);
        return;
    }

    this.logger.debug('Processing job ' + job.name + ' #' + job.id + '...');

    await processor(job);
  }

  private async updateSchema(job: Job) {
    const apiKey = await this.botsService.getApiKey();
    const url = await this.getSchemaUrl(apiKey);

    await this.schemaService.updateSchema(job, url);
  }

  private async updateUrl(job: Job) {
    const apiKey = await this.botsService.getApiKey();
    const url = await this.getSchemaUrl(apiKey);
    await this.schemaService.updateUrl(job, url);
  }

  private async updateSchemaOverview(job: Job) {
    const apiKey = await this.botsService.getApiKey();
    const result = await this.getSchemaOverview(apiKey);
    await this.schemaService.updateOverview(job, result);
  }

  private async updateItems(job: Job) {
    const apiKey = await this.botsService.getApiKey();
    const result = await this.getSchemaItems(apiKey, job.data.start);
    await this.schemaService.updateItems(job, result);
  }

  private async updateProtoObjDefs(job: Job) {
    const result = await this.getVDFFromUrl(
      'https://raw.githubusercontent.com/SteamDatabase/GameTracking-TF2/master/tf/resource/tf_proto_obj_defs_english.txt',
    );
    await this.schemaService.updateProtoObjDefs(job, result);
  }

  private async updateItemsGame(job: Job) {
    const result = await this.getVDFFromUrl(job.data.items_game_url!);
    await this.schemaService.updateItemsGame(job, result);
  }

  private async getSchemaUrl(apiKey: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.get(
        'https://api.steampowered.com/IEconItems_440/GetSchemaURL/v0001/',
        {
          params: {
            key: apiKey,
          },
          responseType: 'json',
        },
      ),
    );

    return response.data.result.items_game_url;
  }

  private async getSchemaOverview(
    apiKey: string,
  ): Promise<SchemaOverviewResponse> {
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

  private async getVDFFromUrl(url: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.get(url, {
        transformResponse: (data) => data,
        responseType: 'text',
      }),
    );
    return response.data;
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
