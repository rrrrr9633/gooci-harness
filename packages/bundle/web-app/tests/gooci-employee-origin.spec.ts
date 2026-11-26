import { describe, expect, it } from 'vitest'
import { goociEmployeeOrigin, goociLocalEmployeeOrigin, goociRedeemUrl } from '../src/gooci-employee-origin.ts'

describe('Gooci employee origin', () => {
  it('keeps customer HTTPS on the public redeem URL', () => {
    expect(goociEmployeeOrigin('https://customer.example').origin).toBe('https://customer.example')
    expect(goociRedeemUrl('https://customer.example')).toBe('https://goocidata.top/api/cloud-launch/redeem')
  })

  it('opens loopback HTTP on the fixed port and redeems against the local workbench', () => {
    expect(goociEmployeeOrigin('http://127.0.0.1:8888').origin).toBe('http://127.0.0.1:8888')
    expect(goociRedeemUrl('http://127.0.0.1:8888', 'http://127.0.0.1:8080'))
      .toBe('http://127.0.0.1:8080/api/cloud-launch/redeem')
  })

  it('rejects LAN HTTP and loopback HTTPS', () => {
    expect(() => goociEmployeeOrigin('http://192.168.1.10:8888')).toThrow('Invalid Gooci employee origin')
    expect(() => goociEmployeeOrigin('https://127.0.0.1')).toThrow('Invalid Gooci employee origin')
    expect(() => goociEmployeeOrigin('http://120.0.0.1:8888')).toThrow('Invalid Gooci employee origin')
  })

  it('registers the local employee origin from delivery edition', () => {
    expect(goociLocalEmployeeOrigin({ GOOCI_DELIVERY_EDITION: 'local' })).toBe('http://127.0.0.1:8888')
    expect(goociLocalEmployeeOrigin({})).toBeUndefined()
  })
})
