import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InjectEventDialog from '@/components/InjectEventDialog'
import { Toaster } from '@/components/ui/sonner'
import { makeStore } from '@/store'
import Deliveries from './Deliveries'
import Sources from './Sources'

type Handler = (req: Request, body: unknown) => unknown
/** Routes by "METHOD /path"; returns [status, json] or json. */
function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      const u = new URL(req.url)
      const key = `${req.method} ${u.pathname.replace('/api', '')}`
      const text = await req.text()
      const body = text ? JSON.parse(text) : undefined
      calls.push({ key, body })
      const out = routes[key]?.(req, body) ?? []
      const [status, json] = Array.isArray(out) && out.length === 2 && typeof out[0] === 'number' ? out : [200, out]
      return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })
    }),
  )
  return calls
}
const renderPage = (ui: React.ReactElement) =>
  render(
    <Provider store={makeStore()}>
      {ui}
      <Toaster />
    </Provider>,
  )
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const breakdown = { severity: 0.6, proximity: 1, proximityReason: 'home', override: false, importance: 0.6, threshold: 0.5, fires: true }
const delivery = (id: number, status: string, extra = {}) => ({
  id, status, attempts: 1, lastError: status === 'failed' ? 'smtp down' : null, createdAt: '2026-10-19T10:00:00Z', sentAt: null,
  channelId: 1, ruleId: 1, userId: 1, breakdown,
  event: { id: 9, title: `Event ${id}`, category: 'news', country: 'HU', scope: 'country', url: null, occurredAt: '2026-10-19T10:00:00Z' },
  ...extra,
})
const source = (id: number, extra = {}) => ({
  id, type: 'rss', name: `Feed ${id}`, enabled: true, pollIntervalS: 300, lastPolledAt: null, lastError: null, baselineAt: null, ...extra,
})

describe('InjectEventDialog', () => {
  it('posts the exact body with the country upper-cased and toasts the delivery count', async () => {
    const calls = mockApi({ 'POST /admin/events': () => [201, { event: { id: 1 }, deliveriesCreated: 2 }] })
    renderPage(<InjectEventDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Inject event' }))
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Flood in Hungary' } })
    fireEvent.change(screen.getByLabelText('Country (ISO2)'), { target: { value: 'hu' } })
    const thumb = screen.getByRole('slider')
    thumb.focus()
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'Inject' }))
    expect(await screen.findByText('2 deliveries created')).toBeTruthy()
    expect(calls.find((c) => c.key === 'POST /admin/events')!.body).toEqual({ category: 'news', title: 'Flood in Hungary', country: 'HU', severity: 0.6 })
  })

  it('shows the API error inline and keeps the dialog open', async () => {
    mockApi({ 'POST /admin/events': () => [400, { error: 'invalid request', issues: [{ path: ['country'], message: 'unknown ISO2 country' }] }] })
    renderPage(<InjectEventDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Inject event' }))
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inject' }))
    expect((await screen.findByRole('alert')).textContent).toBe('invalid request | country: unknown ISO2 country')
  })
})

describe('Admin Deliveries', () => {
  it('shows Retry only on failed rows, with the breakdown and error, and POSTs the retry', async () => {
    const calls = mockApi({
      'GET /admin/deliveries': () => [delivery(7, 'failed'), delivery(8, 'sent'), delivery(9, 'pending', { breakdown: { ...breakdown, override: true } })],
      'POST /admin/deliveries/7/retry': () => delivery(7, 'pending'),
    })
    renderPage(<Deliveries />)
    await screen.findByText('Event 7')
    const retry = screen.getAllByRole('button', { name: 'Retry' })
    expect(retry).toHaveLength(1)
    expect(screen.getByText('smtp down')).toBeTruthy()
    expect(screen.getByText('critical override')).toBeTruthy()
    fireEvent.click(retry[0])
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /admin/deliveries/7/retry')).toBe(true))
  })
})

describe('Admin Sources', () => {
  it('sends only {enabled:false} when toggling the switch', async () => {
    const calls = mockApi({ 'GET /admin/sources': () => [source(3)], 'PATCH /admin/sources/3': () => source(3, { enabled: false }) })
    renderPage(<Sources />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Enable source 3' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /admin/sources/3')).toBe(true))
    expect(calls.find((c) => c.key === 'PATCH /admin/sources/3')!.body).toEqual({ enabled: false })
  })

  it('sends only pollIntervalS when saving the interval', async () => {
    const calls = mockApi({ 'GET /admin/sources': () => [source(3)], 'PATCH /admin/sources/3': () => source(3) })
    renderPage(<Sources />)
    fireEvent.change(await screen.findByLabelText('Poll interval (s) for source 3'), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save interval 3' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /admin/sources/3')).toBe(true))
    expect(calls.find((c) => c.key === 'PATCH /admin/sources/3')!.body).toEqual({ pollIntervalS: 600 })
  })

  it('Poll now posts and toasts the result, success and failure', async () => {
    let n = 0
    const calls = mockApi({
      'GET /admin/sources': () => [source(3, { enabled: false, lastError: 'HTTP 500' })],
      'POST /admin/sources/3/poll': () => (n++ ? { ok: false, inserted: 0, error: 'HTTP 503' } : { ok: true, inserted: 4 }),
    })
    renderPage(<Sources />)
    expect(await screen.findByText('HTTP 500')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Poll now 3' }))
    expect(await screen.findByText('Feed 3: 4 new events')).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Poll now 3' }) as HTMLButtonElement).disabled).toBe(false)) // disabled while polling
    fireEvent.click(screen.getByRole('button', { name: 'Poll now 3' }))
    expect(await screen.findByText('Feed 3 failed: HTTP 503')).toBeTruthy()
    expect(calls.filter((c) => c.key === 'POST /admin/sources/3/poll')).toHaveLength(2)
  })
})
