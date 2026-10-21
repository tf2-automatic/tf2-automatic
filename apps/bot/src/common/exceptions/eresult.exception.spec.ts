import { EResult } from 'steam-user';
import { SteamException } from './eresult.exception';

describe('SteamException', () => {
  it('sends the eresult as a number', () => {
    const body = new SteamException('boom', '2' as never).getResponse();

    expect(body).toMatchObject({ eresult: EResult.Fail });
  });
});
