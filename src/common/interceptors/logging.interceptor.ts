import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const method = req.method;
        const url = req.url;
        const requestId = req.id || '-';

        const now = Date.now();
        return next.handle().pipe(
            tap(() =>
                this.logger.log(
                    `${method} ${url} [${requestId}] - ${Date.now() - now}ms`,
                ),
            ),
        );
    }
}