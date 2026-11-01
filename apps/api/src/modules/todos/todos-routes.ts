import z from 'zod'

import { buildPaginatedResponse } from '@/lib/pagination'
import type { StorageProvider } from '@/lib/storage'

import type { Database } from '../../db'
import type {
  FastifyTypedInstance,
  RequirePermission,
  RequireSubscription,
} from '../../types'
import {
  createTodoSchema,
  paginatedTodosSchema,
  todoSchema,
  todosExportQuerySchema,
  todosListQuerySchema,
  updateTodoSchema,
} from './todos-schema'
import { createTodosService } from './todos-service'

export async function todosRoutes(
  app: FastifyTypedInstance,
  {
    database,
    requirePermission,
    requireSubscription,
    storage,
  }: {
    database: Database
    requirePermission: RequirePermission
    requireSubscription: RequireSubscription
    storage: StorageProvider
  }
) {
  const service = createTodosService(database, storage)

  app.get(
    '/todos/export',
    {
      schema: {
        tags: ['todos'],
        description: 'Export todos as PDF',
        querystring: todosExportQuerySchema,
      },
      preHandler: [
        requireSubscription('todos'),
        requirePermission('todos', 'view'),
      ],
    },
    async (request, reply) => {
      let buffer: Buffer
      try {
        buffer = await service.generateReport(request.query)
      } catch {
        return reply.status(500).send({ message: 'Failed to generate report' })
      }
      const date = new Date().toISOString().split('T')[0]
      await request.audit('export', 'todos', undefined, {
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        filterLogic: request.query.filterLogic,
        filterCount: request.query.filters?.length ?? 0,
      })
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="todos-${date}.pdf"`
        )
        .send(buffer)
    }
  )

  app.get(
    '/todos',
    {
      schema: {
        tags: ['todos'],
        description: 'List todos',
        querystring: todosListQuerySchema,
        response: { 200: paginatedTodosSchema },
      },
      preHandler: [
        requireSubscription('todos'),
        requirePermission('todos', 'view'),
      ],
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/todos/:id',
    {
      schema: {
        tags: ['todos'],
        description: 'Get a todo by id',
        params: z.object({ id: z.string() }),
        response: {
          200: todoSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: [
        requireSubscription('todos'),
        requirePermission('todos', 'view'),
      ],
    },
    async (request, reply) => {
      const todo = await service.getById(request.params.id)
      if (!todo) return reply.status(404).send({ message: 'Todo not found' })
      return todo
    }
  )

  app.post(
    '/todos',
    {
      schema: {
        tags: ['todos'],
        description: 'Create a todo',
        body: createTodoSchema,
        response: { 201: todoSchema },
      },
      preHandler: [
        requireSubscription('todos'),
        requirePermission('todos', 'create'),
      ],
    },
    async (request, reply) => {
      const todo = await service.create(request.body)
      await request.audit('create', 'todos', todo.id, request.body)
      return reply.status(201).send(todo)
    }
  )

  app.patch(
    '/todos/:id',
    {
      schema: {
        tags: ['todos'],
        description: 'Update a todo',
        params: z.object({ id: z.string() }),
        body: updateTodoSchema,
        response: {
          200: todoSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: [
        requireSubscription('todos'),
        requirePermission('todos', 'edit'),
      ],
    },
    async (request, reply) => {
      const todo = await service.update(request.params.id, request.body)
      if (!todo) return reply.status(404).send({ message: 'Todo not found' })
      await request.audit('edit', 'todos', request.params.id, request.body)
      return todo
    }
  )

  app.delete(
    '/todos/:id',
    {
      schema: {
        tags: ['todos'],
        description: 'Delete a todo',
        params: z.object({ id: z.string() }),
        response: { 204: z.null().describe('Todo deleted') },
      },
      preHandler: [
        requireSubscription('todos'),
        requirePermission('todos', 'delete'),
      ],
    },
    async (request, reply) => {
      // 204 either way (idempotent), but only a real deletion is audited
      if (await service.remove(request.params.id)) {
        await request.audit('delete', 'todos', request.params.id)
      }
      return reply.status(204).send(null)
    }
  )
}
