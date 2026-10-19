import { errorText, useGetAdminUsersQuery } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Users() {
  const { data = [], isLoading, error } = useGetAdminUsersQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Home</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.id}</TableCell>
            <TableCell>{u.name}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>{u.homeCountry}</TableCell>
            <TableCell>{u.isAdmin && <Badge>admin</Badge>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
