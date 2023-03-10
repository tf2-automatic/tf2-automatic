import SteamID from 'steamid';
import { ParseSteamIDPipe } from './nestjs-steamid-pipe';

describe('ParseSteamID64Pipe', () => {
  it('should be defined', () => {
    expect(new ParseSteamIDPipe()).toBeDefined();
  });

  it('should succeed with valid steamid64', () => {
    const target = new ParseSteamIDPipe();

    const steamID64 = '76561198120070906';

    expect(target.transform(steamID64)).toStrictEqual(new SteamID(steamID64));
  });

  it('should fail with invalid steamid64', () => {
    const target = new ParseSteamIDPipe();

    expect(() => {
      target.transform('abc123');
    }).toThrowError('Invalid SteamID');
  });
});
