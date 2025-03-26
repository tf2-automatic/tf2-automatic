import type { HttpError } from '@tf2-automatic/bot-data';
import type { AxiosResponse } from 'axios';
import { UnrecoverableError } from 'bullmq';

export class CustomUnrecoverableError extends UnrecoverableError {
  public readonly response: AxiosResponse<HttpError>;

  constructor(message: string, response: AxiosResponse<HttpError>) {
    super(message);
    this.response = response;
  }
}

export class CustomError extends Error {
  public readonly response: AxiosResponse<HttpError>;

  constructor(message: string, response: AxiosResponse<HttpError>) {
    super(message);
    this.response = response;
  }
}
