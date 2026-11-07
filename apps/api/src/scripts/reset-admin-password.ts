import { createAuth } from '@/auth'
import { config } from '@/config'
import { db } from '@/db'
import { env } from '@/env'
import { createEmailProvider } from '@/lib/email'
import { resetAdminPassword } from '@/modules/accounts/password-replacement'
import { createAuditRecorder } from '@/modules/audit/audit-recorder'
import { createAuditService } from '@/modules/audit/audit-service'

// `pnpm admin:reset-password <email>` (source, `.env`) or, on a built deploy,
// `pnpm reset-admin-password <email>` (dist/reset-admin-password.js, the
// deploy's environment). Gives the admin account a new random password and
// signs it out everywhere — see `resetAdminPassword()`.
const email = process.argv[2]
if (!email) {
  console.error('Usage: pnpm admin:reset-password <admin email>')
  process.exit(1)
}

const logger = {
  error: (obj: object, msg: string) => console.error(msg, obj),
  warn: (obj: object, msg: string) => console.warn(msg, obj),
}
// Sends nothing: whoever runs this reads the new password here.
const auth = createAuth(
  db,
  createEmailProvider({
    enabled: false,
    from: config.email.from,
    nodeEnv: env.NODE_ENV,
  }),
  config,
  logger
)
const audit = createAuditRecorder(createAuditService(db), logger)

try {
  const result = await resetAdminPassword(db, auth, audit, email)
  if (result.status === 'not_found') {
    console.error(`No account uses ${email}.`)
    process.exit(1)
  }
  if (result.status === 'not_admin') {
    console.error(
      `${email} is not the admin account. The admin sets other users' passwords on the Users screen.`
    )
    process.exit(1)
  }
  console.log(`New password for ${email}: ${result.password}`)
  console.log(
    'Every session of the account was signed out. Sign in with it, then change it on /me/security.'
  )
  process.exit(0)
} catch (error) {
  console.error('Password reset failed:', error)
  process.exit(1)
}
