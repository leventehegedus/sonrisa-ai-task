import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { switchUser } from './session'
import { makeStore } from './store'

const me = { id: 1, name: 'A', email: 'a@x', homeCountry: 'HU', isAdmin: false }

function mockFetch() {
  const fn = vi.fn(async (_req: Request) => new Response(JSON.stringify(me), { headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fn)
  return fn
}
afterEach(() => vi.unstubAllGlobals())

describe('api session header', () => {
  it('sends X-User-Id 1, then 2 after switchUser, and drops the cached state', async () => {
    const fetchMock = mockFetch()
    const store = makeStore()
    await store.dispatch(api.endpoints.getMe.initiate())
    expect(fetchMock.mock.calls[0][0].headers.get('X-User-Id')).toBe('1')
    expect(api.endpoints.getMe.select()(store.getState()).data).toEqual(me)

    store.dispatch(switchUser(2) as never)
    expect(api.endpoints.getMe.select()(store.getState()).data).toBeUndefined()

    await store.dispatch(api.endpoints.getMe.initiate())
    expect(fetchMock.mock.calls[1][0].headers.get('X-User-Id')).toBe('2')
  })
})
