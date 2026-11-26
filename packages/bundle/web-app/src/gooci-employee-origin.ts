const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])
const DEFAULT_LOCAL_ORIGIN = 'http://127.0.0.1:8888'
const DEFAULT_WORKBENCH_ORIGIN = 'http://127.0.0.1:8080'
const CLOUD_REDEEM_URL = 'https://goocidata.top/api/cloud-launch/redeem'

/** Employee site origin: customer HTTPS, or loopback HTTP on the fixed port. */
export function goociEmployeeOrigin(value: string): URL {
  const origin = new URL(value)
  if (value !== origin.origin) throw new Error('Invalid Gooci employee origin')
  if (origin.protocol === 'https:') {
    if (loopbackHost(origin.hostname)) throw new Error('Invalid Gooci employee origin')
    return origin
  }
  if (origin.protocol === 'http:' && origin.port === '8888' && loopbackHost(origin.hostname)) return origin
  throw new Error('Invalid Gooci employee origin')
}

export function goociLocalHttpOrigin(value: string): URL {
  const origin = new URL(value)
  if (value !== origin.origin || origin.protocol !== 'http:' || !loopbackHost(origin.hostname)) {
    throw new Error('Invalid Gooci local redeem origin')
  }
  return origin
}

export function goociRedeemUrl(employeeOrigin: string, redeemOrigin = process.env.GOOCI_LOCAL_WORKBENCH_ORIGIN): string {
  if (goociEmployeeOrigin(employeeOrigin).protocol === 'https:') return CLOUD_REDEEM_URL
  return `${goociLocalHttpOrigin(redeemOrigin || DEFAULT_WORKBENCH_ORIGIN).origin}/api/cloud-launch/redeem`
}

export function goociLocalEmployeeOrigin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.GOOCI_DELIVERY_EDITION === 'local') {
    return goociEmployeeOrigin(env.GOOCI_LOCAL_HARNESS_ORIGIN || DEFAULT_LOCAL_ORIGIN).origin
  }
  const configured = env.GOOCI_EMPLOYEE_PUBLIC_ORIGIN
  return configured === undefined ? undefined : goociEmployeeOrigin(configured).origin
}

function loopbackHost(host: string): boolean {
  return LOOPBACK.has(host.toLowerCase())
}

function privateIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4 || parts.some(part => part.length > 1 && part.startsWith('0'))) return false
  const oct = parts.map(part => Number(part))
  if (oct.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  return oct[0] === 10 || (oct[0] === 172 && oct[1]! >= 16 && oct[1]! <= 31) || (oct[0] === 192 && oct[1] === 168)
}

export function goociLanHttpsHost(host: string): boolean {
  return privateIpv4(host.toLowerCase())
}
