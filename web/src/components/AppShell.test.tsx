import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { setUser } from '@/session'
import { makeStore } from '@/store'
import AppShell from './AppShell'

const users = [
  { id: 1, name: 'Anna' },
  { id: 2, name: 'Bela' },
  { id: 3, name: 'Cili' },
]
const meById: Record<string, object> = {
  '1': { id: 1, name: 'Anna', email: 'a@x', homeCountry: 'HU', isAdmin: true },
  '2': { id: 2, name: 'Bela', email: 'b@x', homeCountry: 'DE', isAdmin: false },
}

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      const body = req.url.endsWith('/api/users') ? users : meById[req.headers.get('X-User-Id') ?? '']
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    }),
  )
}

// jsdom lacks these; Radix Select calls them when opening
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function renderShell(userId: number) {
  mockFetch()
  const store = makeStore()
  store.dispatch(setUser(userId))
  render(
    <Provider store={store}>
      <AppShell />
    </Provider>,
  )
}

describe('AppShell', () => {
  it('shows the Admin tab for an admin', async () => {
    renderShell(1)
    expect(await screen.findByRole('tab', { name: 'Admin' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'My alerts' })).toBeTruthy()
    expect(screen.getByText(/HU/)).toBeTruthy()
  })

  it('hides the Admin tab for a non-admin', async () => {
    renderShell(2)
    expect(await screen.findByRole('tab', { name: 'History' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Admin' })).toBeNull()
  })

  it('lists the 3 users in the switcher and switching user re-fetches /me', async () => {
    renderShell(1)
    await screen.findByRole('tab', { name: 'Admin' })
    fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Anna', 'Bela', 'Cili'])

    fireEvent.click(options[1])
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Admin' })).toBeNull())
    expect(await screen.findByText(/DE/)).toBeTruthy()
  })
})
