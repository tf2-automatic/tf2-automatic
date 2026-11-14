import SteamID from 'steamid';
import {
  DelaysOfflineBotJobs,
  OfflineBotJobsService,
} from './offline-bot-jobs.service';

describe('OfflineBotJobsService', () => {
  it('promotes the jobs of every decorated processor', async () => {
    const host = {
      promoteOfflineBotJobs: jest.fn().mockResolvedValue(undefined),
    };
    const getProviders = jest
      .fn()
      .mockReturnValue([{ instance: host }, { instance: undefined }]);
    const service = new OfflineBotJobsService({ getProviders } as never);
    const steamid = new SteamID('76561198120070906');

    await service.promote(steamid);

    expect(getProviders).toHaveBeenCalledWith({
      metadataKey: DelaysOfflineBotJobs.KEY,
    });
    expect(host.promoteOfflineBotJobs).toHaveBeenCalledWith(steamid);
  });
});
