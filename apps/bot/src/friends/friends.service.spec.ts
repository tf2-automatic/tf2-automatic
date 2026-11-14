import { EventEmitter } from 'events';
import SteamID from 'steamid';
import SteamUser from 'steam-user';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  const target = new SteamID('76561198000000001');
  const other = new SteamID('76561198000000002');
  const None = SteamUser.EFriendRelationship.None;
  const Friend = SteamUser.EFriendRelationship.Friend;

  let client: EventEmitter & {
    myFriends: Record<string, number>;
    removeFriend: jest.Mock;
    chat: EventEmitter;
  };
  let service: FriendsService;

  // Mimic steam-user, which emits a global and a per-user event
  const emit = (sid: SteamID, rel: number) => {
    client.emit('friendRelationship', sid, rel);
    client.emit('friendRelationship#' + sid.getSteamID64(), sid, rel);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    client = Object.assign(new EventEmitter(), {
      myFriends: { [target.getSteamID64()]: Friend },
      removeFriend: jest.fn(),
      chat: new EventEmitter(),
    });
    service = new FriendsService(
      { getClient: () => client } as never,
      { publish: jest.fn().mockResolvedValue(undefined) } as never,
      { set: jest.fn() } as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('ignores unrelated relationship events', async () => {
    const promise = service.deleteFriend(target);
    emit(other, Friend);
    emit(target, None);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves immediately when not a friend', async () => {
    client.myFriends = {};
    await expect(service.deleteFriend(target)).resolves.toBeUndefined();
    expect(client.removeFriend).not.toHaveBeenCalled();
  });

  it('rejects after 5s and removes the listener', async () => {
    const promise = service.deleteFriend(target);
    const assertion = expect(promise).rejects.toThrow('Timeout');
    jest.advanceTimersByTime(5000);
    await assertion;
    expect(
      client.listenerCount('friendRelationship#' + target.getSteamID64()),
    ).toBe(0);
  });
});
