import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { ManagerService } from '../manager/manager.service';
import { BotsService } from './bots.service';

describe('BotsService', () => {
  it('reads the api key from the bot that was picked', async () => {
    const bots = [
      { steamid64: '1', host: 'a', port: 1 },
      { steamid64: '2', host: 'b', port: 2 },
    ];
    const keys: Record<string, string> = { a: 'key1', b: 'key2' };

    const httpService = {
      get: jest.fn((url: string) => {
        const bot = bots.find((b) => url.includes(`//${b.host}:`));
        return of({
          data: { steamid64: bot?.steamid64, apiKey: keys[bot?.host ?? ''] },
        });
      }),
    };
    const service = new BotsService(
      httpService as unknown as HttpService,
      {
        getRunningBots: jest.fn().mockResolvedValue(bots),
      } as unknown as ManagerService,
    );

    // Pick the second bot
    jest.spyOn(Math, 'random').mockReturnValue(0.9);

    await expect(service.getApiKey()).resolves.toBe('key2');

    jest.restoreAllMocks();
  });
});
