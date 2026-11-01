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
      throw new Error('boom')
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

  it('leaves other errors to Fastify (500)', async () => {
    const res = await post('other')
    expect(res.statusCode).toBe(500)
  })
})
