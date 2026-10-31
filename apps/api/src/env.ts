import { z } from 'zod'

// Secrets and per-deploy values only. Application settings live in
// `src/app.config.ts`.
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1),
  BASE_URL: z.url(),
  CLIENT_URL: z.url(),
  RESEND_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
})

export const env = envSchema.parse(process.env)
