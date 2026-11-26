import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { describe, expect, it } from 'vitest'
import { goociEmployeeEnterRoute } from '../src/gooci-employee-enter.ts'

function exchange(method: string, host = 'customer.example', extra: Record<string, string> = {}) {
  const req = new IncomingMessage(new Socket())
  req.method = method
  req.url = '/gooci/enter?code=abc'
  req.headers = { host, ...extra }
  const res = new ServerResponse(req)
  const chunks: Buffer[] = []
  res.write = (chunk: any) => { chunks.push(Buffer.from(chunk)); return true }
  const end = res.end.bind(res)
  res.end = (chunk?: any) => {
    if (chunk) chunks.push(Buffer.from(chunk))
    return end(chunk)
  }
  goociEmployeeEnterRoute('https://customer.example').handler(req, res)
  return { status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), allow: res.getHeader('Allow') }
}

function localExchange(method: string, host = '127.0.0.1:8888') {
  const req = new IncomingMessage(new Socket())
  req.method = method
  req.url = '/gooci/enter?code=abc'
  req.headers = { host }
  const res = new ServerResponse(req)
  const chunks: Buffer[] = []
  res.write = (chunk: any) => { chunks.push(Buffer.from(chunk)); return true }
  const end = res.end.bind(res)
  res.end = (chunk?: any) => {
    if (chunk) chunks.push(Buffer.from(chunk))
    return end(chunk)
  }
  goociEmployeeEnterRoute('http://127.0.0.1:8888').handler(req, res)
  return { status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }
}

describe('Gooci employee enter page', () => {
  it('serves a same-origin page that posts the launch code to the employee session', () => {
    const page = exchange('GET')
    expect(page.status).toBe(200)
    expect(page.body).toContain("fetch('/gooci/session'")
    expect(page.body).toContain('JSON.stringify({ code })')
    expect(page.body).not.toContain('token=')
  })

  it('rejects a cross-host GET and a mutating method', () => {
    expect(exchange('GET', 'other.example').status).toBe(403)
    expect(exchange('POST').status).toBe(405)
    expect(exchange('POST').allow).toBe('GET, HEAD')
  })

  it('serves the same enter page on the local loopback origin', () => {
    const page = localExchange('GET')
    expect(page.status).toBe(200)
    expect(page.body).toContain("fetch('/gooci/session'")
  })
})
