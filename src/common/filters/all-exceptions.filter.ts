import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Converts every thrown error into a single, consistent JSON envelope and maps
 * common Prisma errors to sensible HTTP status codes.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      error = exception.name;
      message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, error, message } = this.mapPrismaError(exception));
    } else if (this.isMulterError(exception)) {
      status =
        exception.code === 'LIMIT_FILE_SIZE'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST;
      error = 'UploadError';
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const envelope: ErrorEnvelope = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(envelope);
  }

  private isMulterError(exception: unknown): exception is Error & { code: string } {
    return exception instanceof Error && exception.name === 'MulterError' && 'code' in exception;
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'A record with this unique value already exists',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'NotFound',
          message: 'The requested record was not found',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'BadRequest',
          message: 'Related record does not exist (foreign key constraint failed)',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'DatabaseError',
          message: 'A database error occurred',
        };
    }
  }
}
