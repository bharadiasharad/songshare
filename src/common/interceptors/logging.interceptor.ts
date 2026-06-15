import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs each request's method, path, status and duration.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const status = http.getResponse<{ statusCode: number }>().statusCode;
        this.logger.log(`${method} ${url} ${status} +${Date.now() - start}ms`);
      }),
    );
  }
}
