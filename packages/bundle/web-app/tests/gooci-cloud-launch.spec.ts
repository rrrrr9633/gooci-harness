import { describe, expect, it, vi } from 'vitest'
import { createCloudLaunchRedeemer } from '../src/gooci-cloud-launch.ts'

const deploymentId = 'ca8546a4-4e5d-4e59-a462-d521a63fbf0a'
const credential = 'test-credential'
const code = 'a'.repeat(43)
const data = { userId: 'employee-one', appCode: 'AI_HUB', modules: ['AI_HUB', 'APP_EQKB'] }

describe('Gooci cloud launch redemption', () => {
  it('sends the deployment credential only to the fixed HTTPS endpoint and binds the returned identity', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 0, data }))
    const redeem = createCloudLaunchRedeemer(deploymentId, credential, request)
    await expect(redeem(code)).resolves.toEqual({ deploymentId, ...data })
    expect(request).toHaveBeenCalledExactlyOnceWith('https://goocidata.top/api/cloud-launch/redeem', {
      method: 'POST', redirect: 'error', signal: expect.any(AbortSignal),
      headers: { 'Content-Type': 'application/json', 'X-Gooci-Deployment-Credential': credential },
      body: JSON.stringify({ deploymentId, code }),
    })
  })

  it('rejects an invalid code before any network request', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(createCloudLaunchRedeemer(deploymentId, credential, request)('bad')).rejects.toThrow('Invalid Gooci launch code')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    [403, { code: 0, data }],
    [200, { code: 1, data }],
    [200, { code: 0, data: { ...data, modules: ['APP_EQKB'] } }],
    [200, { code: 0, data: { ...data, userId: null } }],
  ])('rejects an invalid redemption response (HTTP %i)', async (status, body) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))
    await expect(createCloudLaunchRedeemer(deploymentId, credential, request)(code)).rejects.toThrow('Gooci launch redemption failed')
  })

  it('does not expose upstream exception details or retry a consumed code', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(credential))
    await expect(createCloudLaunchRedeemer(deploymentId, credential, request)(code)).rejects.toThrow(/^Gooci launch redemption failed$/)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
