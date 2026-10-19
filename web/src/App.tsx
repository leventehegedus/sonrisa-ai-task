import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Me = { name: string; homeCountry: string; isAdmin: boolean }
type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; me: Me }
  | { kind: 'error'; message: string }

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // shortcut: plain fetch + hard-coded user 1 until RTK Query and the user switcher (Tasks 11b/11c)
  useEffect(() => {
    let cancelled = false
    setStatus({ kind: 'loading' })
    fetch('/api/me', { headers: { 'X-User-Id': '1' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as Me
      })
      .then((me) => !cancelled && setStatus({ kind: 'ok', me }))
      .catch((e: unknown) => {
        if (!cancelled) {
          setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  let text = 'Connecting…'
  if (status.kind === 'ok') {
    const { name, homeCountry, isAdmin } = status.me
    text = `Connected to API as ${name} (${homeCountry}${isAdmin ? ', admin' : ''})`
  } else if (status.kind === 'error') {
    text = `API not reachable: ${status.message}`
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>World Alerts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p>{text}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </CardContent>
      </Card>
    </main>
  )
}
