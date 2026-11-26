import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { goociEmployeeOrigin } from './gooci-employee-origin.ts'

/** First-party page that exchanges a launch code, then opens the employee Harness URL. */
export function goociEmployeeEnterRoute(publicOrigin: string): WebRoute {
  const origin = goociEmployeeOrigin(publicOrigin)
  return {
    kind: 'exact',
    path: '/gooci/enter',
    handler(req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD')
        res.writeHead(405, { 'Cache-Control': 'no-store' })
        res.end()
        return
      }
      if (req.headers.host !== origin.host || (req.headers.origin && req.headers.origin !== origin.origin)) {
        res.writeHead(403, { 'Cache-Control': 'no-store' })
        res.end()
        return
      }
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      })
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(`<!doctype html><meta charset="utf-8"><title>谷器</title><body><script>
const params = new URLSearchParams(location.search)
const code = params.get('code')
const fn = params.get('fn')
const next = /^[A-Z][A-Z0-9_]{0,49}$/.test(fn ?? '') ? '/?fn=' + encodeURIComponent(fn) : '/'
fetch('/gooci/session', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code }),
}).then((response) => {
  if (!response.ok) throw new Error()
  location.replace(next)
}).catch(() => { document.body.textContent = '登录失败' })
</script></body>`)
    },
  }
}
