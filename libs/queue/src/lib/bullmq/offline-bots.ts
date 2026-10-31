import { DelayedError, Job, Queue } from 'bullmq';

// Jobs for an offline bot wait this long unless the bot comes back first
export const OFFLINE_BOT_DELAY = 60 * 1000;

type KeyedQueue = Pick<Queue, 'toKey' | 'client'>;

function getKey(queue: KeyedQueue, bot: string): string {
  return queue.toKey('offline-bot:' + bot);
}

export async function delayJobForOfflineBot(
  queue: KeyedQueue,
  job: Job,
  bot: string,
  token: string,
  delay: number,
): Promise<never> {
  // Delay before flagging so a promote never misses a flagged job
  await job.moveToDelayed(Date.now() + delay, token);

  const key = getKey(queue, bot);
  const client = await queue.client;
  // Expires so bots that never come back don't leave sets behind
  await client
    .multi()
    .runCommand('sadd', [key, job.id])
    .runCommand('pexpire', [key, OFFLINE_BOT_DELAY * 2])
    .exec();

  throw new DelayedError();
}

export async function promoteOfflineBotJobs(
  queue: KeyedQueue & Pick<Queue, 'getJob'>,
  bot: string,
): Promise<void> {
  const key = getKey(queue, bot);
  const client = await queue.client;
  const result = await client.multi().smembers(key).del(key).exec();
  const ids = (result?.[0]?.[1] ?? []) as string[];

  await Promise.all(
    ids.map(async (id) => {
      const job = await queue.getJob(id);
      // Fails if the job is no longer delayed
      await job?.promote().catch(() => undefined);
    }),
  );
}
