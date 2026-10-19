import { errorText, useGetAdminRulesQuery, useGetAdminUsersQuery } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Rules() {
  const { data = [], isLoading, error } = useGetAdminRulesQuery()
  const { data: users = [] } = useGetAdminUsersQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Rule</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead>Keywords</TableHead>
          <TableHead>Threshold</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{users.find((u) => u.id === r.userId)?.name ?? r.userId}</TableCell>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.categories.join(', ')}</TableCell>
            <TableCell className="whitespace-normal">{r.keywords.join(', ') || '-'}</TableCell>
            <TableCell>{r.threshold}</TableCell>
            <TableCell><Badge variant={r.enabled ? 'secondary' : 'outline'}>{r.enabled ? 'enabled' : 'disabled'}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
