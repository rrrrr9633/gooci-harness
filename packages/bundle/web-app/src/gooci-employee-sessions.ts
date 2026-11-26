import { createHash, randomBytes } from 'node:crypto'
import type { CloudLaunchIdentity } from './gooci-cloud-launch.ts'

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000
const SESSION_LIMIT = 10_000
const TOKEN = /^[A-Za-z0-9_-]{43}$/

export interface GoociEmployee {
  readonly deploymentId: string
  readonly userId: string
}

type Redeem = (code: string) => Promise<CloudLaunchIdentity>

function digest(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

/** Process-local employee login sessions. They identify an employee but never authorize a module or a Harness capability. */
export function createGoociEmployeeSessions(redeem: Redeem, now: () => number = Date.now) {
  const sessions = new Map<string, { employee: GoociEmployee; expiresAt: number }>()

  function lookup(token: string | undefined) {
    if (!token || !TOKEN.test(token)) return undefined
    const key = digest(token)
    const session = sessions.get(key)
    if (!session) return undefined
    if (session.expiresAt > now()) return { key, session }
    sessions.delete(key)
    return undefined
  }

  return {
    /** Redeem before changing the previous login. Grants are not retained in the session. */
    async establish(code: string, previousToken?: string) {
      const { deploymentId, userId, appCode } = await redeem(code)
      const previous = lookup(previousToken)
      const issuedAt = now()
      if (sessions.size >= SESSION_LIMIT && !previous) {
        for (const [key, session] of sessions) {
          if (session.expiresAt <= issuedAt) sessions.delete(key)
        }
        if (sessions.size >= SESSION_LIMIT) throw new Error('Gooci employee session capacity reached')
      }
      const token = randomBytes(32).toString('base64url')
      const expiresAt = issuedAt + SESSION_LIFETIME_MS
      const employee = Object.freeze({ deploymentId, userId })
      if (previous) sessions.delete(previous.key)
      sessions.set(digest(token), { employee, expiresAt })
      return { token, expiresAt, employee, appCode }
    },
    identify(token: string | undefined): GoociEmployee | undefined {
      return lookup(token)?.session.employee
    },
    revoke(token: string | undefined): void {
      const current = lookup(token)
      if (current) sessions.delete(current.key)
    },
  }
}
