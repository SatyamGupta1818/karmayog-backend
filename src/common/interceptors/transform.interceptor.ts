import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

/**
 * Wraps every successful response in a consistent envelope so clients get the
 * same shape from every endpoint (mirrors the error shape from AllExceptionsFilter).
 *
 * If a handler already returns an object with a `message` field, that message is
 * lifted into the envelope and the rest becomes `data`.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((payload: any) => {
        let message = 'Success';
        let data = payload;

        // Lift a plain { message, ...rest } into the envelope.
        if (payload && typeof payload === 'object' && 'message' in payload) {
          const { message: msg, ...rest } = payload;
          message = msg;
          data = Object.keys(rest).length ? rest : null;
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
