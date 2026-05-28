import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
    statusCode: number;
    message: string | string[];
    error: string;
    timestamp: string;
    path: string;
    requestId?: string;
}

// Explicit interface for NestJS HttpException responses to avoid using 'any'
interface NestHttpExceptionResponse {
    message?: string | string[];
    error?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = 'Internal Server Error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                // Cast to our interface instead of 'any'
                const res = exceptionResponse as NestHttpExceptionResponse;
                message = res.message ?? message;
                error = res.error ?? exception.name;
            }
        } else if (exception instanceof QueryFailedError) {
            // TypeORM's QueryFailedError stores the original driver error in 'driverError'
            const driverError = exception.driverError as { code?: string } | undefined;
            if (driverError?.code === '23505') {
                status = HttpStatus.CONFLICT;
                message = 'A record with this data already exists';
                error = 'Conflict';
            }
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        // Format message for logging to prevent template expression restrictions on arrays
        const logMessage = Array.isArray(message) ? message.join(', ') : message;

        if (status >= 500) {
            this.logger.error(
                `${request.method} ${request.url} → ${status}`,
                exception instanceof Error ? exception.stack : String(exception),
            );
        } else {
            this.logger.warn(`${request.method} ${request.url} → ${status}: ${logMessage}`);
        }

        const body: ErrorResponse = {
            statusCode: status,
            message,
            error,
            timestamp: new Date().toISOString(),
            path: request.url,
        };

        response.status(status).json(body);
    }
}