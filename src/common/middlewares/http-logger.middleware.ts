import { Injectable, NestMiddleware } from '@nestjs/common';
const morgan = require("morgan")
import { Logger } from 'winston';
import { createLogger } from 'winston';

const httpLogger: Logger = createLogger(); // optional if you want Winston stream

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
    private logger = morgan(
        ':method :url :status :res[content-length] - :response-time ms',
        {
            stream: {
                write: (message: string) => console.log(`[HTTP] ${message.trim()}`),
            },
        },
    );

    use(req: any, res: any, next: () => void) {
        this.logger(req, res, next);
    }
}