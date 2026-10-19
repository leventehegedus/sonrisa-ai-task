import { useState } from 'react'
import { toast } from 'sonner'
import { errorText, useCreateRuleMutation, useDeleteRuleMutation, useGetChannelsQuery, useGetRulesQuery, useUpdateRuleMutation } from '@/api'
import RuleForm from '@/components/RuleForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Rule } from '@/types'

export default function Rules() {
  const { data: rules = [], isLoading, error } = useGetRulesQuery()
  const { data: channels = [] } = useGetChannelsQuery()
  const [createRule] = useCreateRuleMutation()
  const [updateRule] = useUpdateRuleMutation()
  const [deleteRule] = useDeleteRuleMutation()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const fail = (err: unknown) => toast.error(errorText(err))

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-destructive">{errorText(error)}</p>

  return (
    <div className="flex flex-col gap-3">
      {editing === 'new' ? (
        <RuleForm
          channels={channels}
          onCancel={() => setEditing(null)}
          onSubmit={async (r) => {
            await createRule(r).unwrap()
            setEditing(null)
          }}
        />
      ) : (
        <Button className="self-start" onClick={() => setEditing('new')}>New rule</Button>
      )}
      {rules.length === 0 && editing !== 'new' && <p className="text-muted-foreground">No rules yet.</p>}
      {rules.map((r: Rule) =>
        editing === r.id ? (
          <RuleForm
            key={r.id}
            initial={r}
            channels={channels}
            onCancel={() => setEditing(null)}
            onSubmit={async (b) => {
              await updateRule({ id: r.id, ...b }).unwrap()
              setEditing(null)
            }}
          />
        ) : (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{r.name}</span>
              <span className="flex flex-wrap gap-1 text-sm text-muted-foreground">
                threshold {r.threshold}
                {r.categories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                {r.keywords.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}
                {r.channelIds.length > 0 && <span>→ {r.channelIds.map((id) => `#${id}`).join(', ')}</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                aria-label={`Enable ${r.name}`}
                checked={r.enabled}
                onCheckedChange={(enabled) => updateRule({ id: r.id, enabled }).unwrap().catch(fail)}
              />
              <Button size="sm" variant="outline" onClick={() => setEditing(r.id)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => deleteRule(r.id).unwrap().catch(fail)}>Delete</Button>
            </div>
          </div>
        ),
      )}
    </div>
  )
}
