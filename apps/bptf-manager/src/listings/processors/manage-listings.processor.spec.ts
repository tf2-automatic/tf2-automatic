import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { AgentsService } from '../../agents/agents.service';
import { RateLimitsService } from '../../rate-limits/rate-limits.service';
import { TokensService } from '../../tokens/tokens.service';
import { ManageListingsService } from '../manage-listings.service';
import { ManageListingsProcessor } from './manage-listings.processor';

type DeleteAllJob = Parameters<
  ManageListingsProcessor['handleDeleteAllAction']
>[0];

describe('ManageListingsProcessor delete all', () => {
  const job = {
    data: { steamid64: '76561198120070906' },
  } as unknown as DeleteAllJob;

  function setup(getAgent: jest.Mock) {
    const manageListingsService = { deleteAllListings: jest.fn() };
    const rateLimitsService = {
      scheduleOrDelay: jest.fn((_j, _l, _t, _k, fn) => fn()),
    };
    const processor = new ManageListingsProcessor(
      manageListingsService as unknown as ManageListingsService,
      {
        getToken: jest.fn().mockResolvedValue({}),
      } as unknown as TokensService,
      { getAgent } as unknown as AgentsService,
      rateLimitsService as unknown as RateLimitsService,
      new ClsService(new AsyncLocalStorage()),
    );
    return { processor, manageListingsService, rateLimitsService };
  }

  it('skips before scheduling when the agent is registered again', async () => {
    const s = setup(jest.fn().mockResolvedValue({}));

    await expect(s.processor.handleDeleteAllAction(job)).resolves.toBe(false);
    expect(s.rateLimitsService.scheduleOrDelay).not.toHaveBeenCalled();
    expect(s.manageListingsService.deleteAllListings).not.toHaveBeenCalled();
  });

  it('skips inside the callback when registered while waiting', async () => {
    const s = setup(
      jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({}),
    );

    await s.processor.handleDeleteAllAction(job);

    expect(s.rateLimitsService.scheduleOrDelay).toHaveBeenCalled();
    expect(s.manageListingsService.deleteAllListings).not.toHaveBeenCalled();
  });

  it('deletes all listings when the agent is not registered', async () => {
    const s = setup(jest.fn().mockResolvedValue(null));

    await s.processor.handleDeleteAllAction(job);

    expect(s.manageListingsService.deleteAllListings).toHaveBeenCalled();
  });
});
