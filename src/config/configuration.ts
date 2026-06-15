/**
 * Typed configuration factory. Reads validated env vars into a structured object
 * consumed via ConfigService (e.g. `config.get('storage.uploadDir')`).
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  auth: {
    url: string;
    secret: string;
  };
  corsOrigin: string[];
  database: {
    url: string;
  };
  storage: {
    uploadDir: string;
    maxUploadBytes: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  auth: {
    url: process.env.BETTER_AUTH_URL as string,
    secret: process.env.BETTER_AUTH_SECRET as string,
  },
  corsOrigin: (process.env.CORS_ORIGIN ?? '*').split(',').map((o) => o.trim()),
  database: {
    url: process.env.DATABASE_URL as string,
  },
  storage: {
    uploadDir: process.env.UPLOAD_DIR ?? './uploads',
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES ?? '26214400', 10),
  },
});
