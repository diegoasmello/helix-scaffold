export type RequestConfig<TData = unknown> = {
  baseURL?: string | URL
  url: string
  method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
  params?: object
  data?: TData | FormData
  responseType?: string
  signal?: AbortSignal
  headers?: HeadersInit
}

export type ResponseConfig<TData = unknown> = {
  data: TData
  status: number
  statusText: string
  headers: Headers
}

export type ResponseErrorConfig<TError = unknown> = TError

export type Client = typeof client

/**
 * Thrown for every non-2xx response. `message` comes from the API body
 * (`{ message }`) when present. `status` and `code` (the body's optional
 * `code`, e.g. `'external_id_taken'`) let callers branch on specific failures
 * and show their own translated message.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

let _baseUrl = ''

/**
 * `baseUrl` is the API's origin plus the spec's server path (`/api`): the
 * generated paths are relative to it (`/todos`).
 */
export function configure(options: { baseUrl: string }) {
  _baseUrl = options.baseUrl
}

export const client = async <TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>
): Promise<ResponseConfig<TData>> => {
  const { url, method, data, params, signal, headers: configHeaders } = config

  // Appended, not resolved: `new URL('/todos', 'https://host/api')` would
  // drop the base's path (`/api`).
  const baseUrl = String(config.baseURL ?? _baseUrl).replace(/\/+$/, '')
  const fullUrl = new URL(`${baseUrl}${url}`)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        fullUrl.searchParams.set(key, String(value))
      }
    }
  }

  const headers: Record<string, string> = {
    ...(configHeaders as Record<string, string>),
  }

  if (data !== undefined && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(fullUrl.toString(), {
    method,
    headers,
    body:
      data instanceof FormData
        ? data
        : data !== undefined
          ? JSON.stringify(data)
          : undefined,
    signal,
    credentials: 'include',
  })

  const responseData =
    response.status === 204
      ? null
      : await response.json().catch(() => undefined)

  if (!response.ok) {
    const body = responseData as { message?: string; code?: string } | undefined
    throw new ApiError(
      body?.message ?? response.statusText,
      response.status,
      typeof body?.code === 'string' ? body.code : undefined
    )
  }

  return {
    data: responseData as TData,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  }
}

export default client
