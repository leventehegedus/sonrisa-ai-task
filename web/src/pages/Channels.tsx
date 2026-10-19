import { useState } from 'react'
import { toast } from 'sonner'
import {
  errorText,
  useCreateChannelMutation,
  useDeleteChannelMutation,
  useGetChannelsQuery,
  useTestChannelMutation,
  useUpdateChannelMutation,
} from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Channel } from '@/types'

// the one config field per channel type that the user may type
const FIELD: Record<string, { key: string; label: string; replace: string }> = {
  email: { key: 'to', label: 'Email address (blank = your account email)', replace: 'Change address' },
  slack: { key: 'webhookUrl', label: 'Slack webhook URL', replace: 'Replace webhook' },
}

function AddChannel() {
  const [create] = useCreateChannelMutation()
  const [type, setType] = useState('email')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const field = FIELD[type]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      await create({ type, config: value.trim() ? { [field.key]: value.trim() } : {} }).unwrap()
      setValue('')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(t) => { setType(t); setValue('') }}>
            <SelectTrigger className="w-32" aria-label="Channel type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">email</SelectItem>
              <SelectItem value="slack">slack</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <Label htmlFor="channel-value">{field.label}</Label>
          <Input id="channel-value" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button type="submit">Add channel</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  )
}

function ChannelRow({ c }: { c: Channel }) {
  const [update] = useUpdateChannelMutation()
  const [remove] = useDeleteChannelMutation()
  const [test, { isLoading: testing }] = useTestChannelMutation()
  const [replacement, setReplacement] = useState('')
  const [error, setError] = useState<string>()
  const field = FIELD[c.type]
  const shown = Object.values(c.config).join(' ')

  async function sendTest() {
    try {
      const r = await test(c.id).unwrap()
      if (r.ok) toast.success('Test sent')
      else toast.error(`Test failed: ${r.error ?? 'unknown error'}`)
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  // config is sent only when the user typed a new value: the masked one would be rejected (R-018)
  async function replace(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      await update({ id: c.id, config: { [field.key]: replacement.trim() } }).unwrap()
      setReplacement('')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{c.type}</span> <span className="text-muted-foreground">#{c.id}</span>{' '}
          <span data-testid={`config-${c.id}`}>{shown}</span>
        </span>
        <div className="flex items-center gap-2">
          <Switch
            aria-label={`Enable channel ${c.id}`}
            checked={c.enabled}
            onCheckedChange={(enabled) => update({ id: c.id, enabled }).unwrap().catch((err) => toast.error(errorText(err)))}
          />
          <Button size="sm" variant="outline" disabled={testing} onClick={sendTest}>Send test</Button>
          <Button size="sm" variant="destructive" onClick={() => remove(c.id).unwrap().catch((err) => toast.error(errorText(err)))}>Delete</Button>
        </div>
      </div>
      {field && (
        <form onSubmit={replace} className="flex items-center gap-2">
          <Input aria-label={field.replace} placeholder={field.replace} value={replacement} onChange={(e) => setReplacement(e.target.value)} />
          <Button type="submit" size="sm" variant="outline" disabled={!replacement.trim()}>Save</Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default function Channels() {
  const { data: channels = [], isLoading, error } = useGetChannelsQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>
  return (
    <div className="flex flex-col gap-3">
      <AddChannel />
      {channels.length === 0 && <p className="text-muted-foreground">No channels yet.</p>}
      {channels.map((c) => <ChannelRow key={c.id} c={c} />)}
    </div>
  )
}
