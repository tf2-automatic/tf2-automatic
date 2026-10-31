import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetEscrowDto } from './escrow';

async function ttlErrors(ttl: number) {
  const errors = await validate(plainToInstance(GetEscrowDto, { ttl }));
  return errors.filter((e) => e.property === 'ttl');
}

describe('GetEscrowDto', () => {
  it('rejects ttl 0', async () => {
    expect(await ttlErrors(0)).toHaveLength(1);
  });

  it.each([-1, 3600])('accepts ttl %i', async (ttl) => {
    expect(await ttlErrors(ttl)).toHaveLength(0);
  });
});
