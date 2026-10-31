import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import SteamID from 'steamid';
import type { CustomWorkerHost } from './processor';
import type { JobData } from './types';

// Marks processors whose jobs are delayed while their bot is offline
export const DelaysOfflineBotJobs = DiscoveryService.createDecorator();

@Injectable()
export class OfflineBotJobsService {
  constructor(private readonly discovery: DiscoveryService) {}

  async promote(steamid: SteamID): Promise<void> {
    const hosts = this.discovery
      .getProviders({ metadataKey: DelaysOfflineBotJobs.KEY })
      .map((wrapper) => wrapper.instance as CustomWorkerHost<JobData>)
      .filter((host) => host !== undefined);

    await Promise.all(hosts.map((host) => host.promoteOfflineBotJobs(steamid)));
  }
}
