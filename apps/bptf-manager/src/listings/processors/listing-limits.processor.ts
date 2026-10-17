import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { ClsService } from 'nestjs-cls';
import { AccountWorkerHost } from '../../common/account-worker-host';
import { bullWorkerSettings } from '@tf2-automatic/queue';
import { Logger } from '@nestjs/common';
import { ListingLimitsService } from '../listing-limits.service';
import { TokensService } from '../../tokens/tokens.service';
import { Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import { Token } from '@tf2-automatic/bptf-manager-data';
import { ListingLimitsResponse } from '../interfaces/bptf.interface';
import SteamID from 'steamid';

@Processor('listing-limits', {
  settings: bullWorkerSettings,
})
export class ListingLimitsProcessor extends AccountWorkerHost {
  private readonly logger = new Logger(ListingLimitsProcessor.name);

  constructor(
    private readonly listingLimitsService: ListingLimitsService,
    private readonly tokensService: TokensService,
    cls: ClsService,
  ) {
    super(cls);
  }

  async processJob(job: Job): Promise<void> {
    const steamid = new SteamID(job.data.steamid64);

    const token = await this.tokensService.getToken(steamid);

    const start = Date.now();
    const result = await this.getLimits(token);
    const duration = Date.now() - start;

    const limits = {
      cap: result.listings.total,
      used: result.listings.used,
      promoted: result.listings.promotionSlotsAvailable,
    };

    this.logger.debug(
      `Got listing limits (cap: ${limits.cap}, used: ${limits.used}, promoted: ${limits.promoted}) in ${duration}ms`,
    );

    await this.listingLimitsService.saveLimits(steamid, limits);
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
      `Failed to get listing limits for job ${job.id}: ${err.message}`,
    );

    if (err instanceof AxiosError) {
      console.error('Status code ' + err.response?.status);
      console.error(err.response?.data);
    } else {
      console.error(err);
    }
  }
}
