import { EventEmitter } from 'events';
import { TF2_LOST_EVENT } from '@tf2-automatic/bot-data';
import { TF2Service } from './tf2.service';

jest.mock('tf2', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');
  return {
    __esModule: true,
    default: class extends EventEmitter {
      backpack = [{ id: '1' }];
      useItem = jest.fn();
      deleteItem = jest.fn();
    },
  };
});

describe('TF2Service', () => {
  let service: TF2Service;
  let tf2: EventEmitter;
  let publish: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    publish = jest.fn().mockResolvedValue(undefined);
    service = new TF2Service(
      {
        getClient: () => new EventEmitter(),
        joinGame: jest.fn(),
        exitGame: jest.fn(),
      } as never,
      { publish } as never,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tf2 = (service as any).tf2;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([
    ['deleteItem', 'processDeleteItem'],
    ['useItem', 'processUseItem'],
  ])('%s ignores itemRemoved(null) while pending', async (_, method) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promise = (service as any)[method]('1') as Promise<void>;

    expect(() => tf2.emit('itemRemoved', null)).not.toThrow();
    tf2.emit('itemRemoved', { id: '1' });

    await expect(promise).resolves.toBeUndefined();
  });

  it('does not publish TF2_LOST_EVENT for a null item', () => {
    tf2.emit('itemRemoved', null);
    expect(publish).not.toHaveBeenCalled();

    tf2.emit('itemRemoved', { id: '1' });
    expect(publish).toHaveBeenCalledWith(TF2_LOST_EVENT, { id: '1' });
  });
});
