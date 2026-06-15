import * as Joi from 'joi';

/**
 * Joi schema validating process environment at boot. The app fails fast with a
 * descriptive error if anything required is missing or malformed.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),

  BETTER_AUTH_URL: Joi.string().uri().required(),
  BETTER_AUTH_SECRET: Joi.string().min(16).required(),
  CORS_ORIGIN: Joi.string().default('*'),

  DATABASE_URL: Joi.string().required(),

  UPLOAD_DIR: Joi.string().default('./uploads'),
  MAX_UPLOAD_BYTES: Joi.number().integer().positive().default(26_214_400),
});
