import fs from 'node:fs/promises'

import { faker } from '@faker-js/faker'
import { sql } from 'drizzle-orm'

import { createAuth } from '@/auth'
import { config } from '@/config'
import type { Permission } from '@/config/permissions'
import { db } from '@/db'
import {
  rolePermissions,
  roles,
  TODO_NORMALIZED_FIELDS,
  TODO_SLUG,
  todoAttachments,
  todos,
  user,
} from '@/db/schema'
import { env } from '@/env'
import { createEmailProvider } from '@/lib/email'
import { normalizedValues } from '@/lib/normalize-text'
import { distinctSlugs } from '@/lib/slug'
import { createStorageProvider } from '@/lib/storage'
import {
  createAccountProvisioning,
  ensureDefaultRole,
} from '@/modules/accounts/account-provisioning'

import { createSeedUploads } from './seed-uploads'

const auth = createAuth(
  db,
  createEmailProvider({
    resendApiKey: env.RESEND_API_KEY,
    from: config.email.from,
    nodeEnv: env.NODE_ENV,
  }),
  config
)
const provisioning = createAccountProvisioning(db, auth, config)

const MODERATOR_PERMISSIONS = [
  { resource: 'todos', action: 'view' },
  { resource: 'todos', action: 'create' },
  { resource: 'todos', action: 'edit' },
  { resource: 'todos', action: 'delete' },
  { resource: 'users', action: 'view' },
  { resource: 'roles', action: 'view' },
  { resource: 'audit', action: 'view' },
] satisfies Permission[]

const USER_PERMISSIONS = [
  { resource: 'todos', action: 'view' },
  { resource: 'todos', action: 'create' },
  { resource: 'todos', action: 'edit' },
  { resource: 'todos', action: 'delete' },
] satisfies Permission[]

const EXTRA_USERS = [
  { name: 'Alice Oliveira', email: 'alice.oliveira@example.com' },
  { name: 'Bruno Santos', email: 'bruno.santos@example.com' },
  { name: 'Carla Ferreira', email: 'carla.ferreira@example.com' },
  { name: 'Daniel Costa', email: 'daniel.costa@example.com' },
  { name: 'Elena Rodrigues', email: 'elena.rodrigues@example.com' },
  { name: 'Felipe Alves', email: 'felipe.alves@example.com' },
  { name: 'Gabriela Lima', email: 'gabriela.lima@example.com' },
  { name: 'Henrique Pereira', email: 'henrique.pereira@example.com' },
  { name: 'Isabela Carvalho', email: 'isabela.carvalho@example.com' },
  { name: 'Joao Martins', email: 'joao.martins@example.com' },
  { name: 'Karen Souza', email: 'karen.souza@example.com' },
  { name: 'Lucas Mendes', email: 'lucas.mendes@example.com' },
  { name: 'Mariana Barbosa', email: 'mariana.barbosa@example.com' },
  { name: 'Nicolas Gomes', email: 'nicolas.gomes@example.com' },
  { name: 'Olivia Nunes', email: 'olivia.nunes@example.com' },
  { name: 'Pedro Araujo', email: 'pedro.araujo@example.com' },
  { name: 'Quintina Lopes', email: 'quintina.lopes@example.com' },
  { name: 'Rafael Rocha', email: 'rafael.rocha@example.com' },
  { name: 'Sara Castro', email: 'sara.castro@example.com' },
  { name: 'Thiago Ribeiro', email: 'thiago.ribeiro@example.com' },
]

const TODO_COUNT = 50
const ATTACHMENT_TODO_COUNT = 15
const ATTACHMENTS_PER_TODO = 2

// A role's permission rows — none for an empty list (Drizzle refuses an
// empty insert), so a product may leave a seed role without permissions.
async function grant(roleId: string, permissions: Permission[]) {
  if (permissions.length === 0) return
  await db
    .insert(rolePermissions)
    .values(
      permissions.map(({ resource, action }) => ({ roleId, resource, action }))
    )
}

async function main() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
  if (Number(count) > 0) {
    console.log('Database already seeded. Skipping.')
    process.exit(0)
  }

  console.log('Cleaning upload directory...')
  await fs.rm(config.uploads.dir, { recursive: true, force: true })
  await fs.mkdir(config.uploads.dir, { recursive: true })

  console.log('Creating roles...')
  const [adminRole] = await db
    .insert(roles)
    // Every permission through `isAdmin`, with no `role_permissions` rows.
    .values({ name: 'Admin', description: 'Full system access', isAdmin: true })
    .returning()
  const [moderatorRole] = await db
    .insert(roles)
    .values({ name: 'Moderator', description: 'Content management access' })
    .returning()
  const [userRole] = await db
    .insert(roles)
    .values({ name: 'User', description: 'Basic user access' })
    .returning()

  console.log('Assigning permissions...')
  await grant(moderatorRole.id, MODERATOR_PERMISSIONS)
  await grant(userRole.id, USER_PERMISSIONS)

  // In open registration, "User" (with its permissions) becomes the default
  // role, so people who sign up get the same access as the seeded users.
  await ensureDefaultRole(db, config)

  console.log('Creating admin user...')
  await provisioning.provisionAccount({
    name: 'Admin',
    email: 'admin@example.com',
    password: 'pass1234',
    roleId: adminRole.id,
  })

  console.log('Creating extra users...')
  for (const [i, userData] of EXTRA_USERS.entries()) {
    await provisioning.provisionAccount({
      name: userData.name,
      email: userData.email,
      password: 'pass1234',
      roleId: i % 2 === 0 ? moderatorRole.id : userRole.id,
    })
  }

  console.log('Creating uploads...')
  const storage = createStorageProvider(config.uploads, env.BASE_URL)
  const imageUploads = await createSeedUploads(db, storage, {
    imageCount: TODO_COUNT,
  })
  const fileUploads = await createSeedUploads(db, storage, {
    fileCount: TODO_COUNT,
  })
  const attachmentUploads = await createSeedUploads(db, storage, {
    fileCount: ATTACHMENT_TODO_COUNT * ATTACHMENTS_PER_TODO,
  })

  console.log('Creating todos...')
  faker.seed(42)
  const todoValues = Array.from({ length: TODO_COUNT }, (_, i) => ({
    title: faker.lorem.sentence({ min: 4, max: 8 }),
    description: faker.lorem.sentences(2),
    content: faker.lorem.sentences(5),
    status: faker.helpers.arrayElement(['pending', 'completed'] as const),
    date: faker.date
      .between({ from: new Date('2024-01-01'), to: new Date('2025-12-31') })
      .toISOString()
      .slice(0, 10),
    imageId: imageUploads.imageIds[i],
    fileId: fileUploads.fileIds[i],
  }))
  const slugs = distinctSlugs(
    todoValues.map((values) => values.title),
    TODO_SLUG
  )
  const todoRows = todoValues.map((values, i) => ({
    ...values,
    ...normalizedValues(values, TODO_NORMALIZED_FIELDS),
    slug: slugs[i],
  }))
  const insertedTodos = await db.insert(todos).values(todoRows).returning()

  console.log('Creating todo attachments...')
  const attachmentValues = insertedTodos
    .slice(0, ATTACHMENT_TODO_COUNT)
    .flatMap((todo, i) =>
      Array.from({ length: ATTACHMENTS_PER_TODO }, (_, j) => ({
        todoId: todo.id,
        uploadId: attachmentUploads.fileIds[i * ATTACHMENTS_PER_TODO + j],
      }))
    )
  await db.insert(todoAttachments).values(attachmentValues)

  console.log(
    `Seed complete: 3 roles, ${1 + EXTRA_USERS.length} users, ${TODO_COUNT} todos, ` +
      `${imageUploads.imageIds.length + fileUploads.fileIds.length + attachmentUploads.fileIds.length} uploads.`
  )
  console.log('Sign in as admin@example.com / pass1234.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
