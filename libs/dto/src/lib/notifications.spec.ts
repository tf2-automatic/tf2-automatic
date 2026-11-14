import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationsReadDto } from './notifications';

async function isValid(body: object) {
  const errors = await validate(plainToInstance(NotificationsReadDto, body));
  return errors.length === 0;
}

describe('NotificationsReadDto', () => {
  it.each([{ ids: ['1'] }, { all: true }])('accepts %j', async (body) => {
    expect(await isValid(body)).toBe(true);
  });

  it.each([
    {},
    { all: false },
    { ids: [] },
    { ids: [1] },
    { ids: ['1'], all: false },
    { ids: ['1'], all: true },
  ])('rejects %j', async (body) => {
    expect(await isValid(body)).toBe(false);
  });
});
