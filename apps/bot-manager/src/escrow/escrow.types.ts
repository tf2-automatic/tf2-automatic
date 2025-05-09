import { GetEscrowResponse, HttpError } from '@tf2-automatic/bot-data';
import { JobData } from '@tf2-automatic/queue';

export type EscrowJobData = JobData<
  {
    steamid64: string;
    token?: string;
    ttl?: number;
  },
  {
    botsAttempted: Record<string, number>;
  }
>;

export interface EscrowErrorData {
  error: HttpError;
  result: null;
}

export interface EscrowResultData {
  result: GetEscrowResponse;
  error: null;
}

export type EscrowResult = (EscrowErrorData | EscrowResultData) & {
  timestamp: number;
  bot: string;
  token?: string;
  ttl?: number;
};

export interface EscrowData {
  timestamp: number;
  error?: Buffer;
  result?: Buffer;
  bot: string;
  token?: string;
}
