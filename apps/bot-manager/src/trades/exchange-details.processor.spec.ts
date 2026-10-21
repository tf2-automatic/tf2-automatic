import { NotFoundException } from '@nestjs/common';
import { EXCHANGE_DETAILS_EVENT } from '@tf2-automatic/bot-manager-data';
import { ExchangeDetailsProcessor } from './exchange-details.processor';

describe('ExchangeDetailsProcessor', () => {
  const bot = { steamid64: '76561198120070906' };
  const offer = { id: '1', tradeID: '2', state: 3 };
  const job = {
    data: { bot: bot.steamid64, options: { offer } },
  } as never;

  const create = (getBot: jest.Mock) => {
    const getExchangeDetails = jest.fn().mockResolvedValue({ details: true });
    const publish = jest.fn().mockResolvedValue(undefined);
    const processor = new ExchangeDetailsProcessor(
      { getExchangeDetails } as never,
      { getBot } as never,
      { publish } as never,
      { run: (fn: () => unknown) => fn() } as never,
    );
    return { processor, getExchangeDetails, publish };
  };

  it('publishes the exchange details event', async () => {
    const { processor, getExchangeDetails, publish } = create(
      jest.fn().mockResolvedValue(bot),
    );

    await processor.processJob(job);

    expect(getExchangeDetails).toHaveBeenCalledWith(bot, '1', true);
    expect(publish).toHaveBeenCalledWith(
      EXCHANGE_DETAILS_EVENT,
      { offer, details: { details: true } },
      expect.anything(),
    );
  });

  it('rethrows a getBot HttpException as a plain Error', async () => {
    const { processor, publish } = create(
      jest.fn().mockRejectedValue(new NotFoundException('Bot not found')),
    );

    const err = await processor.processJob(job).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Bot not found');
    expect(publish).not.toHaveBeenCalled();
  });
});
