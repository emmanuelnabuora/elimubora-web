import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Catches every exception, not just HttpExceptions. Known,
 * intentionally-thrown HttpExceptions (ForbiddenException,
 * NotFoundException, our own validation errors, etc.) pass through
 * their real status and message unchanged — those are already
 * curated, safe-to-show text written throughout this codebase.
 *
 * Anything else — a genuine bug, a raw database error, an
 * unhandled promise rejection surfacing here — is a different
 * category: its message may contain internal details (table names,
 * file paths, connection strings) never meant for a client. In
 * production, these collapse to a single generic message with no
 * internal detail; the real error is always logged server-side in
 * full, in every environment, so nothing is lost — only what
 * reaches the HTTP response is restricted.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception)
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? 'Something went wrong. Please try again.'
        : String(exception instanceof Error ? exception.message : exception)
    });
  }
}
