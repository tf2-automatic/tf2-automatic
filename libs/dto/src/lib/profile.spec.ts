import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateGamesDto } from './profile';

const check = (appids: unknown) =>
  validate(plainToInstance(UpdateGamesDto, { appids }));

describe('UpdateGamesDto', () => {
  it.each([['x', { a: 1 }], ['440'], [1.5]])('rejects %j', async (...a) => {
    expect(await check(a)).toHaveLength(1);
  });

  it('accepts integers', async () => {
    expect(await check([440, 570])).toHaveLength(0);
  });
});
