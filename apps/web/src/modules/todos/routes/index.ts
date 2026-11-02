import {
  getTodosIdSuspenseQueryOptions,
  getTodosSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { filtersSearchParam, searchSearchParam } from '@/lib/list-filters'
import { guardPage } from '@/modules/auth/page-access'
import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import type { TodoItem } from '../types'
import { TODOS_ACCESS } from './access'
import { TodoCreate } from './todos-create'
import { TodoDetail } from './todos-detail'
import { TodoEdit } from './todos-edit'
import { TodoList } from './todos-list'
import { TodoPending } from './todos-pending'

export const todoListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/todos',
  component: TodoList,
  pendingComponent: TodoPending,
  staticData: {
    breadcrumbs: [{ label: 'nav.todos' }],
  },
  beforeLoad: guardPage(TODOS_ACCESS.view),
  validateSearch: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['title', 'status', 'date', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    filters: filtersSearchParam,
    filterLogic: z.enum(['AND', 'OR']).default('AND'),
    search: searchSearchParam,
  }),
  loaderDeps: ({
    search: { page, pageSize, sortBy, sortOrder, filters, filterLogic, search },
  }) => ({
    page,
    pageSize,
    sortBy,
    sortOrder,
    filters,
    filterLogic,
    search,
  }),
  loader: ({ deps }) =>
    queryClient.ensureQueryData(getTodosSuspenseQueryOptions(deps)),
})

export const todoCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/todos/create',
  component: TodoCreate,
  pendingComponent: TodoPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.todos', to: '/todos' },
      { label: 'actions.create' },
    ],
  },
  beforeLoad: guardPage(TODOS_ACCESS.create),
})

export const todoDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/todos/$id',
  component: TodoDetail,
  pendingComponent: TodoPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.todos', to: '/todos' },
      { label: 'actions.view' },
      (data) => ({ label: `#${(data as TodoItem).id}` }),
    ],
  },
  beforeLoad: guardPage(TODOS_ACCESS.view),
  loader: ({ params }) =>
    queryClient.ensureQueryData(getTodosIdSuspenseQueryOptions(params.id)),
})

export const todoEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/todos/$id/edit',
  component: TodoEdit,
  pendingComponent: TodoPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.todos', to: '/todos' },
      { label: 'actions.edit' },
      (data) => ({ label: `#${(data as TodoItem).id}` }),
    ],
  },
  beforeLoad: guardPage(TODOS_ACCESS.edit),
  loader: ({ params }) =>
    queryClient.ensureQueryData(getTodosIdSuspenseQueryOptions(params.id)),
})

export const todosRoutes = [
  todoListRoute,
  todoCreateRoute,
  todoDetailRoute,
  todoEditRoute,
]
