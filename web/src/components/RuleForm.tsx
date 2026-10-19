import { useState } from 'react'
import { errorText } from '@/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { Category, Channel, Rule, RuleInput } from '@/types'

const CATEGORIES: Category[] = ['news', 'market', 'disaster']
const parseKeywords = (s: string) => s.split(',').map((k) => k.trim()).filter(Boolean)
const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v))

type Props = { initial?: Rule; channels: Channel[]; onSubmit: (r: RuleInput) => Promise<unknown>; onCancel: () => void }

export default function RuleForm({ initial, channels, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [categories, setCategories] = useState<Category[]>(initial?.categories ?? [])
  const [keywords, setKeywords] = useState(initial?.keywords.join(', ') ?? '')
  const [threshold, setThreshold] = useState(initial?.threshold ?? 0.5)
  const [channelIds, setChannelIds] = useState<number[]>(initial?.channelIds ?? [])
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      await onSubmit({ name, categories, keywords: parseKeywords(keywords), threshold, channelIds, enabled: initial?.enabled ?? true })
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-name">Name</Label>
        <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1.5 text-sm font-medium">Categories (none = all)</legend>
        {CATEGORIES.map((c) => (
          <Label key={c} className="gap-2">
            <Checkbox checked={categories.includes(c)} onCheckedChange={(v) => setCategories(toggle(categories, c, v === true))} />
            {c}
          </Label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-keywords">Keywords (comma-separated, none = any)</Label>
        <Input id="rule-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="earthquake, bitcoin" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Threshold: {threshold.toFixed(2)}</Label>
        <Slider aria-label="Threshold" min={0} max={1} step={0.05} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
      </div>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1.5 text-sm font-medium">Channels</legend>
        {channels.length === 0 && <span className="text-sm text-muted-foreground">No channels yet, add one on the Channels tab.</span>}
        {channels.map((c) => (
          <Label key={c.id} className="gap-2">
            <Checkbox checked={channelIds.includes(c.id)} onCheckedChange={(v) => setChannelIds(toggle(channelIds, c.id, v === true))} />
            {c.type} #{c.id}
          </Label>
        ))}
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit">{initial ? 'Save' : 'Create rule'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
