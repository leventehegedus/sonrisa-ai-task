import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/store'
import Channels from './Channels'
import History from './History'
import Rules from './Rules'

type Handler = (req: Request, body: unknown) => unknown
/** Routes by "METHOD /path"; returns [status, json] or json. */
function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request) => {
      const key = `${req.method} ${new URL(req.url).pathname.replace('/api', '')}`
      const text = await req.text()
      const body = text ? JSON.parse(text) : undefined
      calls.push({ key, body })
      const out = routes[key]?.(req, body) ?? []
      const [status, json] = Array.isArray(out) && out.length === 2 && typeof out[0] === 'number' ? out : [200, out]
      return new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } })
    }),
  )
  return calls
}
const renderPage = (ui: React.ReactElement) => render(<Provider store={makeStore()}>{ui}</Provider>)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const email = { id: 5, type: 'email', config: { to: 'a@x.io' }, enabled: true }
const slack = { id: 6, type: 'slack', config: { webhookUrl: 'https://hooks.slack.com/…/AbCd' }, enabled: true }

describe('Rules page', () => {
  it('creates a rule with trimmed comma-separated keywords, chosen categories and channels', async () => {
    const calls = mockApi({ 'GET /channels': () => [email], 'POST /rules': () => [201, {}] })
    renderPage(<Rules />)
    fireEvent.click(await screen.findByRole('button', { name: 'New rule' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Quakes' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'disaster' }))
    fireEvent.change(screen.getByLabelText(/Keywords/), { target: { value: ' earthquake , ,árvíz,' } })
    fireEvent.click(await screen.findByRole('checkbox', { name: 'email #5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /rules')).toBe(true))
    expect(calls.find((c) => c.key === 'POST /rules')!.body).toEqual({
      name: 'Quakes', categories: ['disaster'], keywords: ['earthquake', 'árvíz'], threshold: 0.5, channelIds: [5], enabled: true,
    })
  })

  it('shows the API error and issue messages inline', async () => {
    mockApi({ 'POST /rules': () => [400, { error: 'invalid request', issues: [{ path: ['name'], message: 'too small' }] }] })
    renderPage(<Rules />)
    fireEvent.click(await screen.findByRole('button', { name: 'New rule' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }))
    expect((await screen.findByRole('alert')).textContent).toBe('invalid request | name: too small')
  })

  it('lists rules and shows the threshold', async () => {
    mockApi({ 'GET /rules': () => [{ id: 1, name: 'Mine', categories: ['news'], keywords: ['x'], threshold: 0.3, channelIds: [], enabled: true }] })
    renderPage(<Rules />)
    expect(await screen.findByText('Mine')).toBeTruthy()
    expect(screen.getByText(/threshold 0.3/)).toBeTruthy()
  })
})

describe('Channels page', () => {
  it('shows the masked webhook and sends no config when only toggling enabled', async () => {
    const calls = mockApi({ 'GET /channels': () => [slack], 'PATCH /channels/6': () => ({ ...slack, enabled: false }) })
    renderPage(<Channels />)
    expect((await screen.findByTestId('config-6')).textContent).toBe('https://hooks.slack.com/…/AbCd')
    fireEvent.click(screen.getByRole('switch', { name: 'Enable channel 6' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /channels/6')).toBe(true))
    expect(calls.find((c) => c.key === 'PATCH /channels/6')!.body).toEqual({ enabled: false })
  })

  it('sends config on PATCH only after typing a replacement webhook', async () => {
    const calls = mockApi({ 'GET /channels': () => [slack], 'PATCH /channels/6': () => slack })
    renderPage(<Channels />)
    const save = await screen.findByRole('button', { name: 'Save' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Replace webhook'), { target: { value: 'https://hooks.slack.com/services/T/B/new' } })
    fireEvent.click(save)
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /channels/6')).toBe(true))
    expect(calls.find((c) => c.key === 'PATCH /channels/6')!.body).toEqual({ config: { webhookUrl: 'https://hooks.slack.com/services/T/B/new' } })
  })

  it('adds a Slack channel and shows API issues inline', async () => {
    const calls = mockApi({
      'POST /channels': () => [400, { error: 'invalid request', issues: [{ path: ['webhookUrl'], message: 'must be a Slack webhook URL' }] }],
    })
    renderPage(<Channels />)
    fireEvent.pointerDown(await screen.findByRole('combobox', { name: 'Channel type' }), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(await screen.findByRole('option', { name: 'slack' }))
    fireEvent.change(screen.getByLabelText('Slack webhook URL'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add channel' }))
    expect((await screen.findByRole('alert')).textContent).toBe('invalid request | webhookUrl: must be a Slack webhook URL')
    expect(calls.find((c) => c.key === 'POST /channels')!.body).toEqual({ type: 'slack', config: { webhookUrl: 'nope' } })
  })

  it('Send test shows a success toast, and the error toast when ok is false', async () => {
    let result: object = { ok: true }
    mockApi({ 'GET /channels': () => [email], 'POST /channels/5/test': () => result })
    const { Toaster } = await import('@/components/ui/sonner')
    renderPage(<><Toaster /><Channels /></>)
    fireEvent.click(await screen.findByRole('button', { name: 'Send test' }))
    expect(await screen.findByText('Test sent')).toBeTruthy()
    result = { ok: false, error: 'smtp down' }
    await waitFor(() => expect((screen.getByRole('button', { name: 'Send test' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    expect(await screen.findByText('Test failed: smtp down')).toBeTruthy()
  })
})

describe('History page', () => {
  it('renders delivery rows with the score breakdown', async () => {
    mockApi({
      'GET /my/deliveries': () => [{
        id: 1, status: 'sent', attempts: 1, lastError: null, createdAt: '2026-10-19T10:00:00Z', sentAt: null, channelId: 5, ruleId: 1,
        breakdown: { severity: 0.7, proximity: 0.75, proximityReason: 'subregion', override: false, importance: 0.525, threshold: 0.5, fires: true },
        event: { id: 9, title: 'Quake in Italy', category: 'disaster', country: 'IT', scope: 'country', url: null, occurredAt: '2026-10-19T09:00:00Z' },
      }],
    })
    renderPage(<History />)
    expect(await screen.findByText('Quake in Italy')).toBeTruthy()
    expect(screen.getByText('IT')).toBeTruthy()
    expect(screen.getByText('sent')).toBeTruthy()
    expect(screen.getByText(/0\.70 × 0\.75 \(subregion\) = 0\.53/)).toBeTruthy()
  })
})
