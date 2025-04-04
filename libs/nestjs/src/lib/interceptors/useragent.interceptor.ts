import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import type { Request } from 'express';

@Injectable()
export class UserAgentInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const userAgent = request.headers['user-agent'];
    if (userAgent) {
      this.cls.set('userAgent', userAgent);
    }
    return next.handle();
  }
}
