import { useState } from 'react'
import { useGetMeQuery } from '@/api'
import UserSwitcher from '@/components/UserSwitcher'
import AdminLayout from '@/pages/admin/AdminLayout'
import Channels from '@/pages/Channels'
import History from '@/pages/History'
import Rules from '@/pages/Rules'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = [
  { value: 'alerts', label: 'My alerts', content: <Rules /> },
  { value: 'channels', label: 'Channels', content: <Channels /> },
  { value: 'history', label: 'History', content: <History /> },
]
const adminTab = { value: 'admin', label: 'Admin', content: <AdminLayout /> }

export default function AppShell() {
  const { data: me, error, refetch } = useGetMeQuery()
  const [tab, setTab] = useState('alerts')
  const visible = me?.isAdmin ? [...tabs, adminTab] : tabs
  // Admin tab vanishes on switch to non-admin; while `me` reloads (undefined) keep the tab so admin->admin switches don't lose it
  const active = !me || visible.some((t) => t.value === tab) ? tab : 'alerts'
  if (active !== tab) setTab(active) // forget the vanished tab so switching back to an admin doesn't resurrect it

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
      {/* no tabs while `me` (re)loads: avoids a selected-less, blank panel */}
      {me ? (
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
              {t.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-muted-foreground">{error ? 'Could not load your session.' : 'Loading…'}</p>
      )}
      <Toaster />
    </div>
  )
}
