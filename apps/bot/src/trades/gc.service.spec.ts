import { ETradeOfferState } from 'steam-user';
import { GarbageCollectorService } from './gc.service';
import { BotService } from '../bot/bot.service';
import { ConfigService } from '@nestjs/config';
import { Config } from '../common/config/configuration';
import { TradeOfferData } from './types';

const FORGET_TIME = 1000;

describe('GarbageCollectorService', () => {
  let manager: {
    pollData: {
      sent: Record<string, ETradeOfferState>;
      received: Record<string, ETradeOfferState>;
      timestamps: Record<string, number>;
      offerData: Record<string, TradeOfferData>;
    };
    emit: jest.Mock;
  };
  let gc: GarbageCollectorService;

  beforeEach(() => {
    manager = {
      pollData: { sent: {}, received: {}, timestamps: {}, offerData: {} },
      emit: jest.fn(),
    };

    gc = new GarbageCollectorService(
      { getManager: () => manager } as unknown as BotService,
      {
        getOrThrow: () => ({ pollDataForgetTime: FORGET_TIME }),
      } as unknown as ConfigService<Config>,
    );
  });

  it('removes a completed offer missing for the forget time', () => {
    manager.pollData.sent['1'] = ETradeOfferState.Accepted;
    manager.pollData.offerData['1'] = {
      published: ETradeOfferState.Accepted,
      missing: Date.now() - FORGET_TIME - 1,
    };

    gc.cleanup([], []);

    expect(manager.pollData.sent['1']).toBeUndefined();
    expect(manager.pollData.offerData['1']).toBeUndefined();
  });

  it('keeps a completed offer that went missing recently', () => {
    manager.pollData.sent['1'] = ETradeOfferState.Accepted;
    manager.pollData.offerData['1'] = { published: ETradeOfferState.Accepted };

    gc.cleanup([], []);

    expect(manager.pollData.sent['1']).toBe(ETradeOfferState.Accepted);
    expect(manager.pollData.offerData['1'].missing).toEqual(expect.any(Number));
  });

  it('skips offers without offer data', () => {
    manager.pollData.received['1'] = ETradeOfferState.Accepted;

    expect(() => gc.cleanup([], [])).not.toThrow();
    expect(manager.pollData.received['1']).toBe(ETradeOfferState.Accepted);
  });
});
