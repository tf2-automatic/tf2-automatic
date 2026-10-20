import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTradeDto } from './trades';

async function messageErrors(message?: string) {
  const errors = await validate(
    plainToInstance(CreateTradeDto, {
      partner: '76561198120070906',
      message,
      itemsToGive: [],
      itemsToReceive: [],
    }),
  );
  return errors.filter((e) => e.property === 'message');
}

describe('CreateTradeDto message', () => {
  it('rejects an empty message', async () => {
    expect(await messageErrors('')).toHaveLength(1);
  });

  it('rejects a message longer than 128 characters', async () => {
    expect(await messageErrors('a'.repeat(129))).toHaveLength(1);
  });

  it.each(['hi', 'a'.repeat(128), undefined])(
    'accepts message %p',
    async (message) => {
      expect(await messageErrors(message)).toHaveLength(0);
    },
  );
});
