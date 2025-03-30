import assert from 'assert';
import { AxiosError } from 'axios';
import { ClsService } from 'nestjs-cls';
import { BotsAttemptedState, CustomJob, JobData } from './types';
import { Bot } from '@tf2-automatic/bot-manager-data';

export async function botAttemptErrorHandler<
  JobDataType extends JobData<any, BotsAttemptedState>,
>(cls: ClsService, err: any, job: CustomJob<JobDataType>) {
  if (err instanceof AxiosError && err.response !== undefined) {
    const botsAttempted = job.data.state.botsAttempted ?? {};

    const bot: string | undefined = cls.get('bot');
    assert(bot !== undefined, 'Bot is not set');

    botsAttempted[bot] = (botsAttempted[bot] ?? 0) + 1;

    job.data.state.botsAttempted = botsAttempted;

    await job.updateData(job.data).catch(() => {
      // Ignore error
    });
  }
}

export async function selectBot<
  JobDataType extends JobData<any, BotsAttemptedState>,
>(job: CustomJob<JobDataType>, bots: Bot[]) {
  if (bots.length === 0) {
    throw new Error('No bots available');
  }

  let minAttempts = Number.MAX_SAFE_INTEGER;
  let minAttemptsBots: Bot[] = [];

  for (const bot of bots) {
    const attempts = job.data.state.botsAttempted?.[bot.steamid64] ?? 0;

    if (attempts < minAttempts) {
      minAttempts = attempts;
      minAttemptsBots = [bot];
    } else if (attempts === minAttempts) {
      minAttemptsBots.push(bot);
    }
  }

  assert(minAttemptsBots.length > 0, 'No bots after filtering by attempts');

  // Select bots with the least attempts made
  return minAttemptsBots[Math.floor(Math.random() * minAttemptsBots.length)];
}
