import { describe, expect, it, vi } from 'vitest'
import { createGoociEmployeeSessions } from '../src/gooci-employee-sessions.ts'

const identity = (userId: string, deploymentId = 'company-one') => ({
  deploymentId, userId, appCode: 'AI_HUB', modules: ['AI_HUB'],
})

describe('Gooci employee sessions', () => {
  it('keeps employee and deployment identities separate and never retains grants', async () => {
    const sessions = createGoociEmployeeSessions(async (code) => {
      if (code === 'other-company') return identity('alice', 'company-two')
      return identity(code)
    })
    const alice = await sessions.establish('alice')
    const bob = await sessions.establish('bob')
    const other = await sessions.establish('other-company')

    expect(new Set([alice.token, bob.token, other.token]).size).toBe(3)
    expect(sessions.identify(alice.token)).toEqual({ deploymentId: 'company-one', userId: 'alice' })
    expect(sessions.identify(bob.token)).toEqual({ deploymentId: 'company-one', userId: 'bob' })
    expect(sessions.identify(other.token)).toEqual({ deploymentId: 'company-two', userId: 'alice' })
    expect(sessions.identify(undefined)).toBeUndefined()
    expect(sessions.identify('a'.repeat(43))).toBeUndefined()
  })

  it('rotates the browser session only after redemption succeeds', async () => {
    const redeem = vi.fn(async (code: string) => identity(code))
    const sessions = createGoociEmployeeSessions(redeem)
    const previous = await sessions.establish('alice')
    redeem.mockRejectedValueOnce(new Error('redemption denied'))
    await expect(sessions.establish('bad-code', previous.token)).rejects.toThrow('redemption denied')
    expect(sessions.identify(previous.token)?.userId).toBe('alice')

    const next = await sessions.establish('bob', previous.token)
    expect(sessions.identify(next.token)?.userId).toBe('bob')
    expect(sessions.identify(previous.token)).toBeUndefined()
  })

  it('rejects expired and revoked sessions without affecting another employee', async () => {
    let now = 1000
    const sessions = createGoociEmployeeSessions(async code => identity(code), () => now)
    const alice = await sessions.establish('alice')
    const bob = await sessions.establish('bob')
    sessions.revoke(alice.token)
    expect(sessions.identify(alice.token)).toBeUndefined()
    now = bob.expiresAt - 1
    expect(sessions.identify(bob.token)?.userId).toBe('bob')
    now = bob.expiresAt
    expect(sessions.identify(bob.token)).toBeUndefined()
  })
})
