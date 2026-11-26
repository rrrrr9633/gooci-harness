const CLOUD_REDEEM_URL = 'https://goocidata.top/api/cloud-launch/redeem'
const CODE = /^[A-Za-z0-9_-]{43}$/
const DEPLOYMENT_ID = /^[A-Fa-f0-9-]{36}$/
const MODULE = /^[A-Z][A-Z0-9_]{0,49}$/

export interface CloudLaunchIdentity {
  readonly deploymentId: string
  readonly userId: string
  readonly appCode: string
  readonly modules: readonly string[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

/** Exchange a launch code on the server. The returned grants are a snapshot, not a session or a continuing authorization decision. */
export function createCloudLaunchRedeemer(deploymentId: string, credential: string, request: typeof fetch = fetch,
  redeemUrl = CLOUD_REDEEM_URL) {
  if (!DEPLOYMENT_ID.test(deploymentId) || !/^[\x21-\x7e]{1,256}$/.test(credential)) {
    throw new Error('Invalid Gooci deployment configuration')
  }
  return async (code: string): Promise<CloudLaunchIdentity> => {
    if (!CODE.test(code)) throw new Error('Invalid Gooci launch code')
    try {
      const response = await request(redeemUrl, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json', 'X-Gooci-Deployment-Credential': credential },
        body: JSON.stringify({ deploymentId, code }),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error()
      }
      const envelope = record(await response.json())
      const data = record(envelope?.data)
      if (envelope?.code !== 0 || !data) throw new Error()
      const { userId, appCode, modules } = data
      if (typeof userId !== 'string' || !userId.trim() || userId.length > 128
        || typeof appCode !== 'string' || !MODULE.test(appCode) || !Array.isArray(modules)
        || !modules.every((module): module is string => typeof module === 'string' && MODULE.test(module))
        || !modules.includes(appCode)) throw new Error()
      return { deploymentId, userId, appCode, modules: [...new Set(modules)] }
    } catch {
      throw new Error('Gooci launch redemption failed')
    }
  }
}
