import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import SteamTradeOfferManager from 'steam-tradeoffer-manager';
import { EResult } from 'steam-user';
import { SteamException } from '../common/exceptions/eresult.exception';
import { TradesService } from './trades.service';

describe('TradesService', () => {
  let service: TradesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TradesService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TradesService>(TradesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('TradesService steam errors', () => {
  function createService(eresultHeader: string) {
    const community = Object.assign(new EventEmitter(), {
      // Steam sends the WebAPI eresult in a header, so the library gets a string
      httpRequest: (_: unknown, callback: (...args: unknown[]) => void) =>
        callback(
          null,
          { statusCode: 200, headers: { 'x-eresult': eresultHeader } },
          {},
        ),
    });

    const manager = new SteamTradeOfferManager({
      steam: new EventEmitter() as never,
      community: community as never,
      dataDirectory: null,
      pollInterval: -1,
    });
    manager.apiKey = 'key';

    const unused = {} as never;

    return new TradesService(
      { getManager: () => manager, getCommunity: () => community } as never,
      {
        getOrThrow: () => ({
          pollFullUpdateInterval: 1000,
          recentThreshold: 1,
        }),
      } as never,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
    );
  }

  it.each([EResult.Fail, EResult.Timeout, EResult.ServiceUnavailable])(
    'sends eresult %i of a failed offer lookup as a number',
    async (eresult) => {
      const service = createService(String(eresult));

      const err = await service.getOffer('1').catch((err) => err);

      expect(err).toBeInstanceOf(SteamException);
      expect(err.getResponse().eresult).toBe(eresult);
    },
  );
});
