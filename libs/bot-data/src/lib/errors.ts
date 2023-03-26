import { EResult } from 'steam-user';

export interface BaseHttpError {
  statusCode?: number;
  message?: string;
  error?: string;
}

export type HttpError = SteamError | BaseHttpError;

export interface SteamError extends BaseHttpError {
  statusCode: 500;
  message: string;
  error: 'SteamException';
  eresult?: EResult;
  details?: string;
}
