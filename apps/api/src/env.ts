import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1),
  BASE_URL: z.url(),
  CLIENT_URL: z.url(),
})

export const env = envSchema.parse(process.env)
