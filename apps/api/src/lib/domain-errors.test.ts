import fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { afterAll, describe, expect, it } from 'vitest'
import z from 'zod'

import {
  DomainError,
  errorSchema,
  registerDomainErrorHandler,
} from './domain-errors'

const app = fastify().withTypeProvider<ZodTypeProvider>()
app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)
registerDomainErrorHandler(app)

app.register(async (scoped) => {
  scoped.withTypeProvider<ZodTypeProvider>().post(
    '/things',
    {
      schema: {
        body: z.object({ name: z.string().min(1) }),
        response: { 201: z.null(), 409: errorSchema('name_taken') },
      },
    },
    async (request) => {
      if (request.body.name === 'taken') {
        throw new DomainError(409, 'name_taken', 'Name already taken')
      }
      if (request.body.name === 'payload') {
        throw Object.assign(new Error('Request body is too large'), {
          statusCode: 413,
        })
      }
      throw new Error(
        'Failed query: update "user" set "email" = $1\nparams: secret@test.com'
      )
    }
  )
})

afterAll(() => app.close())

function post(name: string) {
  return app.inject({ method: 'POST', url: '/things', payload: { name } })
}

describe('registerDomainErrorHandler', () => {
  it('answers a DomainError with its status, message and code (inside plugins too)', async () => {
    const res = await post('taken')
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      message: 'Name already taken',
      code: 'name_taken',
    })
  })

  it('leaves validation errors to Fastify (400)', async () => {
    const res = await post('')
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('FST_ERR_VALIDATION')
  })

  it('answers any other error with a bare 500, never its message', async () => {
    const res = await post('other')
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal Server Error',
    })
    expect(res.body).not.toContain('secret@test.com')
  })

  it('leaves a client error with its own status to Fastify', async () => {
    const res = await post('payload')
    expect(res.statusCode).toBe(413)
    expect(res.json().message).toBe('Request body is too large')
  })
})
