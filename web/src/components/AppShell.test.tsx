import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  '3': { id: 3, name: 'Cili', email: 'c@x', homeCountry: 'AT', isAdmin: true },
}

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      if (req.url.endsWith('/api/me') && req.headers.get('X-User-Id') === '3') await new Promise((r) => setTimeout(r, 100)) // /me for Cili lands late
      const body = req.url.endsWith('/api/users') ? users : req.url.endsWith('/api/me') ? meById[req.headers.get('X-User-Id') ?? ''] : []
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    }),
  )
}

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

  it('falls back to My alerts when the active Admin tab disappears after switching to a non-admin', async () => {
    renderShell(1)
    const admin = await screen.findByRole('tab', { name: 'Admin' })
    fireEvent.mouseDown(admin)
    fireEvent.click(admin)
    expect(await screen.findByRole('button', { name: 'Inject event' })).toBeTruthy()

    fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click((await screen.findAllByRole('option'))[1])
    expect(await screen.findByText(/DE/)).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Admin' })).toBeNull())
    await waitFor(() => expect(screen.getByRole('tab', { name: 'My alerts' }).getAttribute('aria-selected')).toBe('true'))
    expect(await screen.findByText('No rules yet.')).toBeTruthy()

    // switching back to the admin must not resurrect the Admin tab
    fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click((await screen.findAllByRole('option'))[0])
    await screen.findByRole('tab', { name: 'Admin' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'My alerts' }).getAttribute('aria-selected')).toBe('true'))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Admin' }).getAttribute('aria-selected')).toBe('false'))
  })

  it('keeps the Admin tab when switching from one admin to another while /me reloads', async () => {
    renderShell(1)
    const admin = await screen.findByRole('tab', { name: 'Admin' })
    fireEvent.mouseDown(admin)
    fireEvent.click(admin)
    await screen.findByRole('button', { name: 'Inject event' })

    fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click((await screen.findAllByRole('option'))[2])
    expect(await screen.findByText(/AT/)).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Admin' }).getAttribute('aria-selected')).toBe('true')
  })

  it('shows an error instead of "Loading…" when /me fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } })))
    const store = makeStore()
    store.dispatch(setUser(1))
    render(
      <Provider store={store}>
        <AppShell />
      </Provider>,
    )
    expect(await screen.findByText('Could not load your session.')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('shows the placeholder in the user switcher until users load, then the selected name', async () => {
    renderShell(2)
    expect(screen.getByRole('combobox').textContent).toBe('Select user')
    await waitFor(() => expect(screen.getByRole('combobox').textContent).toBe('Bela'))
  })
})
