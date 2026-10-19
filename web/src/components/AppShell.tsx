import { useState } from 'react'
import { useGetMeQuery } from '@/api'
import UserSwitcher from '@/components/UserSwitcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = [
  { value: 'alerts', label: 'My alerts', todo: 'Task 12' },
  { value: 'channels', label: 'Channels', todo: 'Task 12' },
  { value: 'history', label: 'History', todo: 'Task 12' },
]
const adminTab = { value: 'admin', label: 'Admin', todo: 'Task 13' }

export default function AppShell() {
  const { data: me, error, refetch } = useGetMeQuery()
  const [tab, setTab] = useState('alerts')
  const visible = me?.isAdmin ? [...tabs, adminTab] : tabs
  const active = visible.some((t) => t.value === tab) ? tab : 'alerts' // Admin tab vanishes on switch to non-admin

  let status = <span className="text-muted-foreground">Connecting…</span>
  if (me) {
    status = (
      <span>
        {me.name} ({me.homeCountry}) {me.isAdmin && <Badge>admin</Badge>}
      </span>
    )
  } else if (error) {
    const reason = 'status' in error ? `HTTP ${error.status}` : (error.message ?? 'unknown error')
    status = (
      <span className="flex items-center gap-2 text-destructive">
        API not reachable: {reason}
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </span>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">World Alerts</h1>
        <div className="flex items-center gap-3">
          {status}
          <UserSwitcher />
        </div>
      </header>
      <Tabs value={active} onValueChange={setTab}>
        <TabsList>
          {visible.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {visible.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            Coming in {t.todo}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
