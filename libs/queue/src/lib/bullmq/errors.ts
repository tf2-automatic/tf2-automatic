import type { HttpError } from '@tf2-automatic/bot-data';
import { UnrecoverableError } from 'bullmq';

export function createErrorMessage(message: string, response: HttpError) {
  let errorMessage = `Upstream error: ${response.message ?? message}`;

  if (response.statusCode) {
    errorMessage += ` (HTTP ${response.statusCode})`;
  }

  return errorMessage;
}

export function extractErrorMessage(error: Error): HttpError {
  if (!error.message.startsWith('Upstream error: ')) {
    return {};
  }

  let message = error.message.substring(16);

  const match = message.match(/\(HTTP (\d+)\)/);
  let statusCode: number | undefined;
  if (match) {
    statusCode = parseInt(match[1], 10);
    message = message.substring(0, match.index! - 1);
  }

  return {
    message,
    statusCode,
  };
}

export class CustomUnrecoverableError extends UnrecoverableError {
  public readonly response: HttpError;

  constructor(message: string, response: HttpError) {
    super(createErrorMessage(message, response));
    this.response = response;
  }
}

export class CustomError extends Error {
  public readonly response: HttpError;

  constructor(message: string, response: HttpError) {
    super(createErrorMessage(message, response));
    this.response = response;
  }
}
