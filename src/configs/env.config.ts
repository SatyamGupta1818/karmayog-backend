import * as Joi from 'joi';

/**
 * Joi Validation Schema
 * App will CRASH if any required env is missing
 */
export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('production', 'development', 'test')
        .required(),

    PORT: Joi.number().default(3000),

    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().default(5432),
    DB_USER: Joi.string().required(),
    DB_PASS: Joi.string().required(),
    DB_NAME: Joi.string().required(),

    // Secrets the app actually uses to sign/verify tokens. Required so the
    // app fails fast at boot instead of falling back to an unsafe default.
    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

    API_KEY: Joi.string().required(),

    // Comma-separated list of allowed browser origins for CORS.
    CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:5174'),

    REDIS_HOST: Joi.string().default('127.0.0.1'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').optional(),
    REDIS_DB: Joi.number().default(0),

    THROTTLE_TTL: Joi.number().default(60000),
    THROTTLE_LIMIT: Joi.number().default(10),

    MAIL_HOST: Joi.string().required(),
    MAIL_PORT: Joi.string().required(),
    MAIL_USER: Joi.string().required(),
    MAIL_PASSWORD: Joi.string().required(),

}).unknown(true);

/**
 * Central Config Object
 * Equivalent to module.exports config in Express
 */
export const configuration = () => ({
    env: process.env.NODE_ENV,

    server: {
        port: Number(process.env.PORT) || 3000,
    },

    database: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        name: process.env.DB_NAME,
    },

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    cors: {
        origins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean),
    },

    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB),
    },

    security: {
        apiKey: process.env.API_KEY
    },

    email: {
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        mailUser: process.env.MAIL_USER,
        mailPassword: process.env.MAIL_PASSWORD,
    }
});