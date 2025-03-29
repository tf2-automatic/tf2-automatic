import type { HttpError } from '@tf2-automatic/bot-data';
import type { AxiosResponse } from 'axios';
import { UnrecoverableError } from 'bullmq';

export class CustomUnrecoverableError extends UnrecoverableError {
  public readonly response: HttpError;

  constructor(message: string, response: HttpError) {
    super(message);
    this.response = response;
  }
}

export class CustomError extends Error {
  public readonly response: HttpError;

  constructor(message: string, response: HttpError) {
    super(message);
    this.response = response;
  }
}
