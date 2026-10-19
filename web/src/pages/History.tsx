import { errorText, useGetMyDeliveriesQuery } from '@/api'
import ScoreBreakdown from '@/components/ScoreBreakdown'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function History() {
  const { data = [], isLoading, error } = useGetMyDeliveriesQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>
  if (data.length === 0) return <p className="text-muted-foreground">No deliveries yet.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Why</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((d) => (
          <TableRow key={d.id}>
            <TableCell>{new Date(d.createdAt).toLocaleString()}</TableCell>
            <TableCell className="whitespace-normal">
              {d.event.url ? <a href={d.event.url} target="_blank" rel="noreferrer" className="underline">{d.event.title}</a> : d.event.title}
            </TableCell>
            <TableCell>{d.event.category}</TableCell>
            <TableCell>{d.event.country ?? '-'}</TableCell>
            <TableCell>
              <Badge variant={d.status === 'failed' ? 'destructive' : 'secondary'} title={d.lastError ?? undefined}>{d.status}</Badge>
            </TableCell>
            <TableCell><ScoreBreakdown b={d.breakdown} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
