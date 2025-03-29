import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';
import objectHash from 'object-hash';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

interface IdempotencyResponse {
  statusCode: number;
  body: any;
  timestamp: string;
  hash: string;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly store = new NodeCache({
    stdTTL: 60 * 60,
    deleteOnExpire: true,
    useClones: false,
  });

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (request.method !== 'POST') {
      return next.handle();
    }

    const idempotencyKey = request.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return next.handle();
    }

    if (Array.isArray(idempotencyKey)) {
      throw new BadRequestException('Multiple idempotency keys provided');
    }

    const hash = objectHash({
      body: request.body,
      path: request.path,
    });

    const value = this.store.get<IdempotencyResponse>(idempotencyKey);

    if (value === null) {
      throw new ConflictException(
        'Concurrent request using same idempotency key',
      );
    }

    if (value !== undefined) {
      if (hash !== value.hash) {
        throw new BadRequestException(
          'Idempotency key was already used with different request parameters',
        );
      }

      response.status(value.statusCode);
      response.setHeader('X-Idempotency-Cached', 'true');
      response.setHeader('X-Idempotency-Created', value.timestamp);
      return of(value.body);
    }

    return next.handle().pipe(
      tap((data) => {
        const result: IdempotencyResponse = {
          statusCode: response.statusCode,
          body: data,
          timestamp: new Date().toISOString(),
          hash,
        };

        this.store.set(idempotencyKey, result);
        return data;
      }),
      catchError((error) => {
        const httpError =
          error instanceof HttpException
            ? error
            : new InternalServerErrorException();

        if (httpError.getStatus() < 400 || httpError.getStatus() >= 500) {
          const result: IdempotencyResponse = {
            statusCode: httpError.getStatus(),
            body: httpError.getResponse(),
            timestamp: new Date().toISOString(),
            hash,
          };

          this.store.set(idempotencyKey, result);
        } else {
          this.store.del(idempotencyKey);
        }

        return throwError(() => error);
      }),
    );
  }
}
