import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ListingLimitsService } from '../listing-limits.service';
import { TokensService } from '../../tokens/tokens.service';
import { Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import { Token } from '@tf2-automatic/bptf-manager-data';
import { ListingLimitsResponse } from '../interfaces/bptf.interface';
import SteamID from 'steamid';

@Processor('listing-limits')
export class ListingLimitsProcessor extends WorkerHost {
  private readonly logger = new Logger(ListingLimitsProcessor.name);

  constructor(
    private readonly listingLimitsService: ListingLimitsService,
    private readonly tokensService: TokensService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.debug('Processing job ' + job.id);

    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    const result = await this.getLimits(token);

    await this.listingLimitsService.saveLimits(steamid, {
      cap: result.listings.total,
      used: result.listings.used,
      promoted: result.listings.promotionSlotsAvailable,
    });

    this.logger.log('Refreshed limits for ' + steamid.getSteamID64());
  }

  private getLimits(token: Token): Promise<ListingLimitsResponse> {
    return axios
      .get<ListingLimitsResponse>(
        'https://api.backpack.tf/api/classifieds/limits',
        {
          headers: {
            'X-Auth-Token': token.value,
          },
        },
      )
      .then((response) => response.data);
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error('Error in worker');
    console.error(err);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(
      `Failed get listing limits for job ${job.id}: ${err.message}`,
    );

    if (err instanceof AxiosError) {
      console.error('Status code ' + err.response?.status);
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }
}
