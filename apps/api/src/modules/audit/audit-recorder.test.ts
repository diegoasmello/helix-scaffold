import { describe, expect, it, vi } from 'vitest'

import { createAuditRecorder, systemActor } from './audit-recorder'

function recorderWith(log = vi.fn().mockResolvedValue(undefined)) {
  const logger = { error: vi.fn() }
  return { recorder: createAuditRecorder({ log }, logger), log, logger }
}

describe('createAuditRecorder', () => {
  it('records a signed-in user with the request origin', async () => {
    const { recorder, log } = recorderWith()

    await recorder.record(
      {
        kind: 'user',
        id: 'user-1',
        name: 'Alice',
        email: 'alice@test.com',
        ip: '10.0.0.1',
        userAgent: 'Agent/1.0',
      },
      {
        action: 'edit',
        resource: 'roles',
        resourceId: 'r-1',
        metadata: { a: 1 },
      }
    )

    expect(log).toHaveBeenCalledWith({
      userId: 'user-1',
      userName: 'Alice',
      userEmail: 'alice@test.com',
      action: 'edit',
      resource: 'roles',
      resourceId: 'r-1',
      metadata: { a: 1 },
      ip: '10.0.0.1',
      userAgent: 'Agent/1.0',
    })
  })

  it('records a system actor as system:<id>', async () => {
    const { recorder, log } = recorderWith()

    await recorder.record(systemActor('expiration-job', 'Expiration'), {
      action: 'edit',
      resource: 'subscriptions',
    })

    expect(log).toHaveBeenCalledWith({
      userId: 'system:expiration-job',
      userName: 'Expiration',
      userEmail: 'system',
      action: 'edit',
      resource: 'subscriptions',
      resourceId: null,
      metadata: null,
      ip: null,
      userAgent: null,
    })
  })

  it('logs a failed write instead of throwing', async () => {
    const error = new Error('DB down')
    const { recorder, logger } = recorderWith(vi.fn().mockRejectedValue(error))

    await expect(
      recorder.record(systemActor('bootstrap', 'Bootstrap'), {
        action: 'create',
        resource: 'users',
      })
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      { err: error, action: 'create', resource: 'users' },
      'audit log failed'
    )
  })
})
