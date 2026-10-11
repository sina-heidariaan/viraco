import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  ValidationError,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

export interface FieldError {
  field: string;
  message: string;
}

/** The one error body every non-2xx response uses (plan §6.4). */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details: FieldError[];
}

/** ValidationPipe factory: one `{ field, message }` per failed constraint, nested paths dotted. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const details: FieldError[] = [];
  const walk = (list: ValidationError[], prefix: string): void => {
    for (const e of list) {
      const field = prefix ? `${prefix}.${e.property}` : e.property;
      for (const message of Object.values(e.constraints ?? {})) details.push({ field, message });
      if (e.children?.length) walk(e.children, field);
    }
  };
  walk(errors, '');
  return new BadRequestException({ message: 'Validation failed', details });
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: FieldError[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as { message?: unknown; details?: unknown };
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = b.message.map(String).join('; ');
        else message = exception.message;
        if (Array.isArray(b.details)) details = b.details as FieldError[];
      }
    }

    if (status >= 500) {
      // Never send internals (SQL, stack) to the client; log them instead.
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${req.method} ${req.path} -> ${status}`, stack);
      if (!(exception instanceof HttpException)) message = 'Internal server error';
    }

    const payload: ErrorBody = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      details,
    };
    res.status(status).json(payload);
  }
}
