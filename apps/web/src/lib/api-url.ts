import { env } from '@/env'

/**
 * Where the API's routes live: its origin (`VITE_API_URL`) plus the `/api`
 * prefix every route is served under — the server of the OpenAPI spec the
 * client's paths (`/todos`) are relative to. Keeps the web and the API
 * apart on a shared domain: the proxy sends `/api/*` to the API.
 */
export const API_URL = `${env.VITE_API_URL}/api`
