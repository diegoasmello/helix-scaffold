import { eq, sql } from 'drizzle-orm'
import { seed } from 'drizzle-seed'

import { createAuth } from '@/auth'
import { ALL_PERMISSIONS } from '@/config/permissions'
import { db } from '@/db'
import { rolePermissions, roles, todos, user } from '@/db/schema'

const auth = createAuth(db)

const MODERATOR_PERMISSIONS = [
  { resource: 'me', action: 'view' },
  { resource: 'me', action: 'edit' },
  { resource: 'todos', action: 'view' },
  { resource: 'todos', action: 'create' },
  { resource: 'todos', action: 'edit' },
  { resource: 'todos', action: 'delete' },
  { resource: 'users', action: 'view' },
  { resource: 'roles', action: 'view' },
  { resource: 'audit', action: 'view' },
]

const USER_PERMISSIONS = [
  { resource: 'me', action: 'view' },
  { resource: 'me', action: 'edit' },
  { resource: 'todos', action: 'view' },
  { resource: 'todos', action: 'create' },
  { resource: 'todos', action: 'edit' },
  { resource: 'todos', action: 'delete' },
]

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

async function main() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
  if (Number(count) > 0) {
    console.log('Database already seeded. Skipping.')
    process.exit(0)
  }

  console.log('Creating roles...')
  const [adminRole] = await db
    .insert(roles)
    .values({ name: 'Admin', description: 'Full system access' })
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
  await db.insert(rolePermissions).values(
    ALL_PERMISSIONS.map(({ resource, action }) => ({
      roleId: adminRole.id,
      resource,
      action,
    }))
  )
  await db.insert(rolePermissions).values(
    MODERATOR_PERMISSIONS.map(({ resource, action }) => ({
      roleId: moderatorRole.id,
      resource,
      action,
    }))
  )
  await db.insert(rolePermissions).values(
    USER_PERMISSIONS.map(({ resource, action }) => ({
      roleId: userRole.id,
      resource,
      action,
    }))
  )

  console.log('Creating admin user...')
  const adminResult = await auth.api.signUpEmail({
    body: {
      name: 'Diego Mello',
      email: 'diegoasmello@gmail.com',
      password: 'pass1234',
    },
  })
  await db
    .update(user)
    .set({ roleId: adminRole.id })
    .where(eq(user.id, adminResult.user.id))

  console.log('Creating extra users...')
  for (const [i, userData] of EXTRA_USERS.entries()) {
    const result = await auth.api.signUpEmail({
      body: {
        name: userData.name,
        email: userData.email,
        password: 'pass1234',
      },
    })
    const roleId = i % 2 === 0 ? moderatorRole.id : userRole.id
    await db.update(user).set({ roleId }).where(eq(user.id, result.user.id))
  }

  console.log('Creating todos...')
  await seed(db, { todos }, { count: 50, seed: 42 }).refine((f) => ({
    todos: {
      count: 50,
      columns: {
        title: f.loremIpsum({ sentencesCount: 1 }),
        description: f.loremIpsum({ sentencesCount: 2 }),
        content: f.loremIpsum({ sentencesCount: 5 }),
        status: f.valuesFromArray({ values: ['pending', 'completed'] }),
        date: f.date({ minDate: '2024-01-01', maxDate: '2025-12-31' }),
      },
    },
  }))

  console.log(
    `Seed complete: 3 roles, ${1 + EXTRA_USERS.length} users, 50 todos.`
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
