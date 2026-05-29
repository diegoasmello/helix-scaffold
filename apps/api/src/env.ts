import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1),
  BASE_URL: z.url(),
  CLIENT_URL: z.url(),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./storage'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().default(50),
  UPLOAD_BASE_URL: z.url().default('http://localhost:3333'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@localhost'),
})

export const env = envSchema.parse(process.env)
