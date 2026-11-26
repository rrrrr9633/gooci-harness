import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { createGoociEmployeeSessions } from './gooci-employee-sessions.ts'

import { goociEmployeeOrigin } from './gooci-employee-origin.ts'

const HOST_COOKIE = '__Host-gooci_employee'
const LOCAL_COOKIE = 'gooci_employee'
const HOST_COOKIE_ATTRIBUTES = 'Path=/; Secure; HttpOnly; SameSite=Lax'
const LOCAL_COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; SameSite=Lax'
const MAX_BODY = 256

function reply(res: ServerResponse, status: number, data?: unknown) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' })
  res.end(data === undefined ? undefined : JSON.stringify(data))
}

function tokenOf(req: IncomingMessage): string | undefined {
  return goociEmployeeToken(req.headers.cookie)
}

export function goociEmployeeToken(cookieHeader: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader
  const matches = (raw ?? '').split(';').map(part => part.trim())
    .flatMap((part) => {
      if (part.startsWith(`${HOST_COOKIE}=`)) return [part.slice(HOST_COOKIE.length + 1)]
      if (part.startsWith(`${LOCAL_COOKIE}=`)) return [part.slice(LOCAL_COOKIE.length + 1)]
      return []
    })
  return matches[0]
}

export function goociEmployeeCookie(headers: Headers | Readonly<Record<string, string | readonly string[] | undefined>>): string | undefined {
  if (headers instanceof Headers) return goociEmployeeToken(headers.get('cookie') ?? undefined)
  const value = headers.cookie
  return goociEmployeeToken(typeof value === 'string' ? value : value ? [...value] : undefined)
}

function cookieName(secure: boolean): string {
  return secure ? HOST_COOKIE : LOCAL_COOKIE
}

function cookieAttributes(secure: boolean): string {
  return secure ? HOST_COOKIE_ATTRIBUTES : LOCAL_COOKIE_ATTRIBUTES
}

async function readCode(req: IncomingMessage): Promise<string | undefined> {
  if (req.headers['content-type'] !== 'application/json') return undefined
  try {
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const bytes = Buffer.from(chunk)
      length += bytes.length
      if (length > MAX_BODY) return undefined
      chunks.push(bytes)
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(body.code)) return body.code
  } catch {
    return undefined
  }
}

/** Register only employee login state, never the standalone Harness authorization cookie. */
export function goociEmployeeSessionRoute(publicOrigin: string, sessions: ReturnType<typeof createGoociEmployeeSessions>): WebRoute {
  const origin = goociEmployeeOrigin(publicOrigin)
  const secure = origin.protocol === 'https:'
  const name = cookieName(secure)
  const attributes = cookieAttributes(secure)
  return {
    kind: 'exact',
    path: '/gooci/session',
    async handler(req, res) {
      if (req.headers.host !== origin.host || (req.headers.origin && req.headers.origin !== origin.origin)) {
        reply(res, 403)
        return
      }
      const token = tokenOf(req)
      switch (req.method) {
        case 'GET': {
          const employee = sessions.identify(token)
          if (employee) reply(res, 200, employee)
          else reply(res, 401)
          return
        }
        case 'POST': {
          if (req.headers.origin !== origin.origin) return reply(res, 403)
          const code = await readCode(req)
          if (!code) return reply(res, 400)
          try {
            const session = await sessions.establish(code, token)
            res.setHeader('Set-Cookie', `${name}=${session.token}; ${attributes}; Expires=${new Date(session.expiresAt).toUTCString()}`)
            reply(res, 200, { appCode: session.appCode })
          } catch {
            reply(res, 403)
          }
          return
        }
        case 'DELETE': {
          if (req.headers.origin !== origin.origin) return reply(res, 403)
          sessions.revoke(token)
          res.setHeader('Set-Cookie', `${name}=; ${attributes}; Max-Age=0`)
          reply(res, 204)
          return
        }
        default:
          res.setHeader('Allow', 'GET, POST, DELETE')
          reply(res, 405)
      }
    },
  }
}
