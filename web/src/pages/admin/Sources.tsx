import { useState } from 'react'
import { toast } from 'sonner'
import { errorText, useGetSourcesQuery, usePollSourceMutation, useUpdateSourceMutation } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Source } from '@/types'

function SourceRow({ s }: { s: Source }) {
  const [update] = useUpdateSourceMutation()
  const [poll, { isLoading: polling }] = usePollSourceMutation()
  const [interval, setInterval] = useState(String(s.pollIntervalS))

  async function pollNow() {
    try {
      const r = await poll(s.id).unwrap()
      if (r.ok) toast.success(`${s.name}: ${r.inserted} new events`)
      else toast.error(`${s.name} failed: ${r.error}`)
    } catch (err) {
      toast.error(`${s.name} failed: ${errorText(err)}`)
    }
  }
  async function save() {
    try {
      await update({ id: s.id, pollIntervalS: Number(interval) }).unwrap()
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  return (
    <TableRow>
      <TableCell>{s.name}</TableCell>
      <TableCell>
        <Switch aria-label={`Enable source ${s.id}`} checked={s.enabled} onCheckedChange={(enabled) => update({ id: s.id, enabled })} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number" min={60} max={86400} className="w-24" aria-label={`Poll interval (s) for source ${s.id}`}
            value={interval} onChange={(e) => setInterval(e.target.value)}
          />
          <Button size="sm" variant="outline" aria-label={`Save interval ${s.id}`} disabled={Number(interval) === s.pollIntervalS} onClick={save}>Save</Button>
        </div>
      </TableCell>
      <TableCell>{s.lastPolledAt ? new Date(s.lastPolledAt).toLocaleString() : 'never'}</TableCell>
      <TableCell className="whitespace-normal text-destructive">{s.lastError}</TableCell>
      <TableCell>
        <Button size="sm" aria-label={`Poll now ${s.id}`} disabled={polling} onClick={pollNow}>Poll now</Button>
      </TableCell>
    </TableRow>
  )
}

export default function Sources() {
  const { data = [], isLoading, error } = useGetSourcesQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead>Interval (s)</TableHead>
          <TableHead>Last polled</TableHead>
          <TableHead>Last error</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((s) => (
          <SourceRow key={s.id} s={s} />
        ))}
      </TableBody>
    </Table>
  )
}
