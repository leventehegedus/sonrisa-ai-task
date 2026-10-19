import { useState } from 'react'
import { errorText, useGetAdminUsersQuery, useGetDeliveriesQuery, useRetryDeliveryMutation } from '@/api'
import ScoreBreakdown from '@/components/ScoreBreakdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Deliveries() {
  const [status, setStatus] = useState('all')
  const { data = [], isLoading, error } = useGetDeliveriesQuery(status === 'all' ? undefined : status)
  const { data: users = [] } = useGetAdminUsersQuery()
  const [retry, { error: retryError }] = useRetryDeliveryMutation()
  return (
    <div className="flex flex-col gap-3">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-40" aria-label="Status filter"><SelectValue /></SelectTrigger>
        <SelectContent>
          {['all', 'pending', 'sent', 'failed'].map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(error || retryError) && <p role="alert" className="text-destructive">{errorText(error ?? retryError)}</p>}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">No deliveries.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Why</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{new Date(d.createdAt).toLocaleString()}</TableCell>
                <TableCell>{users.find((u) => u.id === d.userId)?.name ?? d.userId ?? '-'}</TableCell>
                <TableCell className="whitespace-normal">{d.event.title}</TableCell>
                <TableCell className="whitespace-normal">
                  <Badge variant={d.status === 'failed' ? 'destructive' : 'secondary'}>{d.status}</Badge>
                  {d.lastError && <div className="text-xs text-destructive">{d.lastError}</div>}
                </TableCell>
                <TableCell><ScoreBreakdown b={d.breakdown} /></TableCell>
                <TableCell>
                  {d.status === 'failed' && <Button size="sm" variant="outline" onClick={() => retry(d.id)}>Retry</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
