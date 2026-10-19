import { errorText, useGetEventsQuery } from '@/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Events() {
  const { data = [], isLoading, error } = useGetEventsQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>
  if (data.length === 0) return <p className="text-muted-foreground">No events yet.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Severity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((e) => (
          <TableRow key={e.id}>
            <TableCell>{new Date(e.occurredAt).toLocaleString()}</TableCell>
            <TableCell>{e.source}</TableCell>
            <TableCell className="whitespace-normal">
              {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="underline">{e.title}</a> : e.title}
            </TableCell>
            <TableCell>{e.category}</TableCell>
            <TableCell>{e.country ?? '-'}</TableCell>
            <TableCell>{e.severity.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
