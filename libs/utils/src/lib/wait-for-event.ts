import type { EventEmitter } from 'events';

export interface WaitForEventOptions {
  // Ignore emits where this returns false, called with the event's args
  filter?: (...args: any[]) => boolean;
  // Milliseconds
  timeout: number;
  timeoutError?: string;
  // Reject if this other event fires first
  rejectOn?: { event: string; error: string };
  // Resolve once no matching event fired for `timeout` ms instead
  quiet?: boolean;
}

export function waitForEvent(
  emitter: EventEmitter,
  event: string,
  options: WaitForEventOptions,
): Promise<unknown[]> {
  const {
    filter,
    timeout,
    timeoutError = 'Timed out waiting for event',
    rejectOn,
    quiet = false,
  } = options;

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout;

    const stop = () => {
      clearTimeout(timer);
      emitter.removeListener(event, listener);
      if (rejectOn) {
        emitter.removeListener(rejectOn.event, rejectListener);
      }
    };

    const startTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stop();
        if (quiet) {
          resolve([]);
        } else {
          reject(new Error(timeoutError));
        }
      }, timeout);
    };

    const listener = (...args: unknown[]) => {
      if (filter && !filter(...args)) {
        return;
      }

      if (quiet) {
        return startTimer();
      }

      stop();
      resolve(args);
    };

    const rejectListener = () => {
      stop();
      reject(new Error(rejectOn?.error));
    };

    if (rejectOn && rejectOn.event !== event) {
      emitter.once(rejectOn.event, rejectListener);
    }

    emitter.on(event, listener);
    startTimer();
  });
}
