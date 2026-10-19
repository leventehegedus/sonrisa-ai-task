import { useGetUsersQuery } from '@/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { switchUser } from '@/session'
import { useAppDispatch, useAppSelector } from '@/store'

// shortcut: dev user switcher stands in for login, replace with real auth
export default function UserSwitcher() {
  const dispatch = useAppDispatch()
  const userId = useAppSelector((s) => s.session.userId)
  const { data: users = [] } = useGetUsersQuery()

  return (
    <Select value={String(userId)} onValueChange={(v) => dispatch(switchUser(Number(v)))}>
      <SelectTrigger className="w-40" aria-label="Switch user">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
