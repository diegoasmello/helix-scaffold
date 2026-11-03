/**
 * Every route the API serves lives under this path — the REST endpoints,
 * better-auth (`/api/auth/*`), the docs (`/api/docs`) and the uploaded files
 * (`/api/files/*`). With the web on the same domain, a reverse proxy sends
 * `/api/*` to this server and everything else to the SPA: no page path
 * (`/users`, `/todos`…) ever collides with an endpoint.
 */
export const API_PREFIX = '/api'
