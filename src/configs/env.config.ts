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

    JWT_SECRET: Joi.string().required(),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),

    API_KEY: Joi.string().required()

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
        secret: process.env.JWT_SECRET,
        accessExpirationMinutes: Number(
            process.env.JWT_ACCESS_EXPIRATION_MINUTES,
        ),
        refreshExpirationDays: Number(
            process.env.JWT_REFRESH_EXPIRATION_DAYS,
        ),
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET
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
    }
});