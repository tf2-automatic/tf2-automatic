import { EResult } from 'steam-user';
import { SteamException } from './eresult.exception';

function getBody(eresult?: unknown) {
  return new SteamException('boom', eresult as EResult).getResponse() as {
    eresult?: unknown;
    message: string;
  };
}

describe('SteamException', () => {
  it('keeps a numeric eresult', () => {
    expect(getBody(EResult.Timeout).eresult).toBe(EResult.Timeout);
  });

  it('turns the eresult header string into a number', () => {
    const body = getBody('2');

    expect(body.eresult).toBe(EResult.Fail);
    expect(JSON.parse(JSON.stringify(body)).eresult).toBe(EResult.Fail);
    expect(body.message).toBe(
      'Steam responded to request with an error with EResult 2',
    );
  });

  it('leaves a missing eresult undefined', () => {
    const body = getBody();

    expect(body.eresult).toBeUndefined();
    expect(body.message).toBe('Steam responded to request with an error');
  });

  it.each(['', 'abc', '2abc'])('drops the invalid eresult %j', (eresult) => {
    const body = getBody(eresult);

    expect(body.eresult).toBeUndefined();
    expect(body.message).toBe('Steam responded to request with an error');
  });
});
