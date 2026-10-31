import { BadRequestException } from '@nestjs/common';
import { TradesService } from './trades.service';

describe('TradesService', () => {
  const OWN_STEAMID = '76561198000000001';
  const manager = { createOffer: jest.fn(), on: jest.fn() };

  let service: TradesService;

  beforeEach(() => {
    manager.createOffer.mockReset();
    service = Object.create(TradesService.prototype);
    Object.assign(service, {
      manager,
      botService: { getSteamID64: () => OWN_STEAMID },
    });
  });

  it('rejects creating a trade with the bot itself', async () => {
    await expect(
      service.createTrade({ partner: OWN_STEAMID } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.createOffer).not.toHaveBeenCalled();
  });

  it('rejects getting user details for the bot itself', async () => {
    const offer = {
      partner: { getSteamID64: () => OWN_STEAMID },
      getUserDetails: jest.fn(),
    };

    await expect(service.getUserDetails(offer as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(offer.getUserDetails).not.toHaveBeenCalled();
  });
});
